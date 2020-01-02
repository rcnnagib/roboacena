//CADASTRO DOS CASOS DE TESTES
const functions = require('/roboacena/src/functions.js')
const xmlFunctions = require('/roboacena/src/xmlFunctions.js')
const rules = require('/roboacena/src/rules.js')	
const {base64decode, base64encode } = require('nodejs-base64');
global.db

async function registerTestCase(req, res){	           	
	
	var result
	var testcase = !req.testcase ? "" : req.testcase
	
	db = await functions.connectMongoDB(URL)		
	res.writeHead(200, {"Content-Type": "text/xml"});
	
	req.request =  base64decode(req.request)
	req.request = xmlFunctions.formatXML(req.request)	
	req.request = xmlFunctions.applyRegexScapes(req.request)			
	req.request =  base64encode(await messageRequest(req.model, req.service, req.request))
	result = await db.collection('testcases').replaceOne({testcase:testcase, service: req.service}, req, {upsert:true})
	
	if(result.upsertedId){
		console.log('Registrado caso de teste: \n' + base64decode(req.request) )
		res.end( "Caso de teste Registrado com sucesso") 	
	}else if(result.modifiedCount){
		console.log('caso de teste atualizado \n:' + testcase )
		res.end( "Caso de testes atualizao com sucesso") 	
	}
}

async function procTestCase(req, res){
	var rule
	var requestReplaces
	var resReplaces
	var testcase
	var response

	db = await functions.connectMongoDB(URL)
	res.writeHead(200, {"Content-Type": "text/xml"});

	//obtem os replaces para gerar o regex das requisições
	rule = await rules.getRules(req.headers.model, req.headers.service)
	if( rule && rule.request && rule.request.replaces){
		requestReplaces = rule.request.replaces
	}

	//verifica se existe regex para a requisição
	testcase = await getTestCase(req.headers.testcaseid, req.headers.model, req.headers.service, req.body, requestReplaces,rule, req.headers.validrequest)
	if(testcase.regexError){									
		console.log("code: "+ testcase.regexError.code + "\nError:" + testcase.regexError.error + "\ntestcase:" + req.headers.testcase)
		res.end(xmlFunctions.getSoapFault(testcase.regexError.code, testcase.regexError.error))
		return		
	}
	
	if(!req.headers.validrequest){
		response = base64decode(testcase.response)
	}
	else if(rule && rule.request && rule.request.mode === 'async'){				
		testcase.response = base64decode(testcase.response)
		//replaces de campos do lote do XML
		if(rule.retRequest.replaces.lote){
			testcase.response = await xmlFunctions.replaceXML(testcase.response, rule.retRequest.replaces.lote)
		}		
		//replaces de campos de cada  documento do XML
		if(rule.retRequest.replaces.doc){
			items = getNodeXml(testcase.response, rule.request.docRootTag, "complex")
			for(i=0; i < items.length; i++){
				item = items[i]			
				if(item.length > 0){
					newXml = await xmlFunctions.replaceXML(item, rule.retRequest.replaces.doc)
					testcase.response.replace(item, newXml)
				}
			}
		}
		//obtem o rebido da requisicao para vincular a a resposta 
		receipt = xmlFunctions.getNodeXml(testcase.response, rule.request.receiptTag, "simple")[0]
		receipt = xmlFunctions.getTagvalue(receipt,rule.request.receiptTag)
		await prepareResponse(req.headers.model, receipt, req.body, testcase.response, rule.response.replaces, rule.request.docRootTag, rule.retRequest.docRootTag)
		res.end(testcase.response)	
	}else{
		//obtem xml e replaces para resposta
		response = base64decode(testcase.response)
		if(rule && rule.response && rule.response.replaces){
			resReplaces = rule.response.replaces
		}

		//caso a requisição seja de retorno assincrono. Busca replaces no cadastro de respostas assincronas
		if( rule && rule.request && rule.request.receiptTag){
			receipt = xmlFunctions.getNodeXml(req.body, rule.request.receiptTag, "simple")[0]
			receipt = xmlFunctions.getTagvalue(receipt,rule.request.receiptTag)
			resReplaces = await db.collection('responses').find({model: req.headers.model, receipt: receipt} ).toArray();				
			if(resReplaces.length === 0){
				return xmlFunctions.getSoapFault('404', 'response not found')
			}
		}
		
		//Aplica os replaces no xml de resposta
		if(resReplaces && resReplaces.length > 0){
			if(resReplaces[0].replaces.lote){
				response = await xmlFunctions.replaceXML(response, resReplaces[0].replaces.lote, req.body)
			}
			if(resReplaces[0].replaces.doc){
				items = xmlFunctions.getNodeXml(response, rule.response.docRootTag, "complex")
				for(nodes=0; nodes < items.length; nodes++){
					item = items[nodes]			
					if(item.length > 0){
						newXml = await xmlFunctions.replaceXML(item, resReplaces[0].replaces.doc[nodes], req.body)
						response = response.replace(item, newXml)								
					}
				}
			}
		}
	}		
	console.log('returning testcase response\n' + response)
	res.end(response)
}

module.exports = {registerTestCase, procTestCase}

//RETORNA CASO DE TESTE 
async function getTestCase(testcaseId, model, service, request, replaces,rule, validRequest){
	var retTestcase = {testcase: null, regexError: {code: "404", error: "Testcase not found"} }
	var testcase
	var regex	

	request = xmlFunctions.formatXML(request)	
	if(testcaseId){
		testcase = await db.collection('testcases').find( {model: model, service: service, testcase: testcaseId} ).toArray()    
		if(!testcase || testcase.length === 0){					
			return retTestcase
		}	
		if(validRequest){
			regex = new RegExp(testcase[0].request,'g')
			if( !regex.exec(request)){
				console.log('caso de teste com falha' )	
				retTestcase.regexError.code = "400"
				retTestcase.regexError.error = xmlFunctions.validTagRegex(request, replaces)
				return	retTestcase
			}
		}
		return retTestcase.testcase = testcase[0]		
	}else{
		testcase = await db.collection('testcases').find( {model: model, service: service} ).toArray()    
		for(ntest = 0; ntest <  testcase.length; ntest++){
			regex = base64decode(testcase[ntest].request)
			regex = new RegExp(regex, 'g')			
			if(request.match(regex)){
				retTestcase.testcase = testcase[ntest]
				return retTestcase.testcase
			}else{
				
				if(replaces.lote){
					request = await xmlFunctions.replaceXML(request, replaces.lote, request)
				}
				if(replaces.doc){
					items = xmlFunctions.getNodeXml(request, rule.request.docRootTag, "complex")
					for(nodes=0; nodes < items.length; nodes++){
						item = items[nodes]			
						if(item.length > 0){
							faultString = xmlFunctions.validTagRegex(item, replaces.doc)
						}
					}
				}

				if(faultString){
					retTestcase.regexError.code = "400"
					retTestcase.regexError.error = faultString
					console.log(faultString)
					return retTestcase
				}else if(ntest === testcase.length-1){
					return retTestcase
				}
			}			
		}
	}
	return retTestcase
}

async function messageRequest(model, service, request ){
	var rule
	var replaces

	rule = await db.collection('rules').find( {model: model, services: { $elemMatch:{ service: service} } }, {'services.$':1} ).toArray()
	if(rule && rule.length > 0){
		if(rule[0].services[0].request && rule[0].services[0].request.replaces){			
			if(rule[0].services[0].request.replaces.lote){
				replaces = rule[0].services[0].request.replaces.lote
				request = await xmlFunctions.replaceXML(request, replaces)
			}			
			if(replaces = rule[0].services[0].request.replaces.doc){
				replaces = rule[0].services[0].request.replaces.doc
				items = xmlFunctions.getNodeXml(request, rule[0].services[0].request.docRootTag, "complex")
				for(docs=0; docs < items.length; docs++){
					item = items[docs]			
					if(item.length > 0){
						newXml = await xmlFunctions.replaceXML(item, replaces)
						request = request.replace(item, newXml)
					}
				}
			}
		}
	}	
	return request
}

async function prepareResponse(model, receipt, request, retRequest, replaces, reqRootTag, retRootTag){
	
	var response = {} 

	if(replaces.lote){		
		response.lote = await fillDocResp(replaces.lote, request, retRequest)
	}

	if(replaces.doc){				
		var itemsRequest = xmlFunctions.getNodeXml(request, reqRootTag, 'complex')
		var itemsRetRequest = xmlFunctions.getNodeXml(retRequest, retRootTag, 'complex')
		var itemRequest
		var itemRetRequest
		var temp
		response.doc = []
		for(docs = 0; docs < itemsRequest.length; docs++){			
			itemRequest = itemsRequest[docs]
			itemRetRequest = itemsRetRequest[0]
			if(itemsRetRequest.length > docs){
				itemRetRequest = itemsRetRequest[docs]
			}
			temp = await fillDocResp(replaces.doc, itemRequest, itemRetRequest)
			response.doc.push(temp)
		}		
	}
	
	result = await db.collection('responses')
					 .replaceOne({model: model, receipt: receipt}, 
						         {model: model, receipt: receipt, replaces: response }, 
								 {upsert:true})    
}

async function fillDocResp(replaces, request, retRequest){

	var field = []

	for(replaceIndex = 0; replaceIndex < replaces.length; replaceIndex++){    
		var tag = replaces[replaceIndex].tag
		var attribute = replaces[replaceIndex].attribute
		var size = replaces[replaceIndex].size
		var from = replaces[replaceIndex].from
		var tagToReplace
		var type = replaces[replaceIndex].type
		let newValue
		var item
		var items
		if(from === 'retRequest') {     
			items = xmlFunctions.getNodeXml(retRequest, tag, type)
		}else if(from === 'request'){
			if(attribute){
				items = xmlFunctions.getAttributeValue(request, attribute)
			}else{
				items = xmlFunctions.getNodeXml(request, tag, type)
			}
			
		}

		if(typeof items == "object"){
			for(i=0; i < items.length;i++){
				item = items[i]
				if(from === 'retRequest') {     				
					tagToReplace  = xmlFunctions.getNodeXml(item, tag, type)[0]
					newValue = xmlFunctions.getTagvalue(tagToReplace, tag)
				}else if(from === 'request'){            
					if(attribute){
						newValue = xmlFunctions.getAttributeValue(item, attribute)
						newValue = newValue.replace('NFe',"")
						newValue = newValue.replace('CTe',"")
						newValue = newValue.replace('MDFe',"")			
					}else{
						tagToReplace  = xmlFunctions.getNodeXml(item, tag, type)[0]
						newValue = xmlFunctions.getTagvalue(tagToReplace, tag)
					}    
					
				}
				field.push({tag: tag, value: newValue } )
			}			
		}else if(typeof items == "string"){
			newValue = items
			newValue = newValue.replace('NFe',"")
			newValue = newValue.replace('CTe',"")
			newValue = newValue.replace('MDFe',"")			
			field.push({tag: tag, value: newValue } ) 
		}
		
		if(from == 'getDate'){
			newValue = functions.getDateTime()
			field.push({tag: tag, value: newValue } ) 
		}else if(from ==='getRandomNumber'){
			newValue = functions.getRandomNumber("1".repeat(size), "9".repeat(size))
			field.push({tag: tag, value: newValue } ) 
		}						
	}
	return field
}