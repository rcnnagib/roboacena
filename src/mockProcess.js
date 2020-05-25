//CADASTRO DOS CASOS DE TESTES
const functions = require('/roboacena/src/functions.js')
const xmlFunctions = require('/roboacena/src/xmlFunctions.js')
const rules = require('/roboacena/src/rules.js')	
const {base64decode, base64encode } = require('nodejs-base64');
const sha1 = require('sha1')
global.db

/**
 * registra os templates para montagem dos simulados de respostas
 * @param {*objeto da requisicao} req 
 * @param {*objeto de retorno da requisicao} res 
 */
async function MockTemplates(req, res){	           	
	var result
	var rule

	res.writeHead(200, {"Content-Type": "text/xml"});
	db = await functions.connectMongoDB(URL)		
	
	rule = await db.collection('rules').findOne( {model: req.model, service: req.service} )

	req.request =  base64decode(req.request)
	req.request = xmlFunctions.formatXML(req.request)	
	req.request = xmlFunctions.applyRegexScapes(req.request)	
	
	//vincula o recibo ao template
	if(rule && rule.type === "return"){		
		receiptTag = xmlFunctions.getNodeXml(req.request, rule.request.receiptTag, 'simple')[0]
		receiptValue =  xmlFunctions.getTagvalue(receiptTag, rule.request.receiptTag)
		req.receipt = receiptValue
	}
	
	req.request =  await messageRequest(req.request, rule)
	
	req.hash = sha1(req.request)
	req.request = base64encode(req.request)
	result = await db.collection('mockTemplates').replaceOne({service: req.service, model: req.model, hash: req.hash}, req, {upsert:true})
	
	if(result.upsertedId){
		console.log('mock template registered successfully: \n' + base64decode(req.request) )
		res.end( "mock template registered successfully") 	
	}else if(result.modifiedCount){
		console.log('mock template updated successfully' )
		res.end( "mock template updated successfully") 	
	}



}

/**
 * Retorna respostas simuladas
 * @param {*} req 
 * @param {*} res 
 */
async function getMockResponse(req, res){
	var rule
	var requestReplaces
	var resReplaces
	var mockProcess 
	var response

	db = await functions.connectMongoDB(URL)
	res.writeHead(200, {"Content-Type": "text/xml"});

	//obtem os replaces para gerar o regex das requisições
	rule = await rules.getRules(req.headers.model, req.headers.service)
	if( rule && rule.request && rule.request.replaces){
		requestReplaces = rule.request.replaces
	}
	
	//verifica se existe regex para a requisição
	mockProcess  = await getMockTemplate(req.headers.testcaseid, req.headers.model, req.headers.service, req.body, requestReplaces,rule, req.headers.validrequest)
	
	//Retorno para caso de teste nao encontrado
	if(mockProcess.regexError){									
		console.log("code: "+ mockProcess.regexError.code + "\nError:" + mockProcess.regexError.error + "\ntestcase:" + req.headers.mockProcess )
		res.end(xmlFunctions.getSoapFault(mockProcess.regexError.code, mockProcess.regexError.error))
		return		
	}
	
	//retorno sem validação da requisição
	if(!req.headers.validrequest){		
		console.log('returning response no check request\n' + response)
		res.end(base64decode(mockProcess.response))
		return
	}
	
	//retorno de recibo para requsiçoes assincronas
	if(rule && rule.receiptMessage){				
		mockProcess.response = base64decode(mockProcess.response)
		//replaces de campos do lote do XML
		if(rule.receiptMessage.replaces.lote){
			mockProcess.response = await xmlFunctions.replaceXML(mockProcess.response, rule.receiptMessage.replaces.lote)
		}		
		//replaces de campos de cada  documento do XML
		if(rule.receiptMessage.replaces.doc){
			items = getNodeXml(mockProcess.response, rule.request.docRootTag, "complex")
			for(i=0; i < items.length; i++){
				item = items[i]			
				if(item.length > 0){
					newXml = await xmlFunctions.replaceXML(item, rule.receiptMessage.replaces.doc)
					mockProcess.response.replace(item, newXml)
				}
			}
		}
		//obtem o rebido da requisicao para vincular a a resposta 
		receipt = xmlFunctions.getNodeXml(mockProcess.response, rule.receiptMessage.receiptTag, "simple")[0]
		receipt = xmlFunctions.getTagvalue(receipt,rule.receiptMessage.receiptTag)
		await prepareResponse(req.headers.model, receipt, req.body, mockProcess.response, rule.response.replaces, rule.request.docRootTag, rule.receiptMessage.docRootTag)
		res.end(mockProcess.response)	
		return
	}
	
	//obtem xml de resposta da requisição
	response = base64decode(mockProcess.response)
	
	//obtem os replaces de respostas sincronas
	if(rule && rule.response && rule.response.replaces){
		resReplaces = rule.response//.replaces
	}

	//obtem os replaces de respostas assincronas
	if( rule && rule.request && rule.request.receiptTag){
		receipt = xmlFunctions.getNodeXml(req.body, rule.request.receiptTag, "simple")[0]
		receipt = xmlFunctions.getTagvalue(receipt,rule.request.receiptTag)
		resReplaces = await db.collection('responses').find({model: req.headers.model, receipt: receipt} ).toArray();				
		if(resReplaces.length === 0){
			return xmlFunctions.getSoapFault('404', 'response not found')
		}
	}
	
	//Aplica os replaces na resposta
	//if(resReplaces && resReplaces.length > 0){
		if(resReplaces.replaces.lote){
			response = await xmlFunctions.replaceXML(req.body, resReplaces.replaces.lote, response)
		}
		if(resReplaces.replaces.doc){
			items = xmlFunctions.getNodeXml(response, rule.response.docRootTag, "complex")
			for(nodes=0; nodes < items.length; nodes++){
				item = items[nodes]			
				if(item.length > 0){
					newXml = await xmlFunctions.replaceXML(item, resReplaces.replaces.doc[nodes], req.body)
					response = response.replace(item, newXml)								
				}
			}
		}
	//}
	res.end(response)	
	return
}

/**
 * Busca template da requisição 
 * @param {*} testcaseId 
 * @param {*modelo do documento} model 
 * @param {*nome do metodo/serviço} service 
 * @param {*xml da requisicao} request 
 * @param {*tags de replace} replaces 
 * @param {*objeto com as regras do simulador} rule 
 * @param {*indica se a requisicao deve ser validade e aplicado repalce dos retornos} validRequest 
 */
async function getMockTemplate(testcaseId, model, service, request, replaces,rule, validRequest){
	var retTestcase = {mockProcess: null, regexError: {code: "404", error: "mockProcess not found"} }
	var mockProcess
	var regex	
	var faultString
	
	request = xmlFunctions.formatXML(request)	
	if(rule && rule.type  && rule.type === "return"){
		var receipt
		receiptTag = xmlFunctions.getNodeXml(request, rule.request.receiptTag, 'simple')[0]
		receiptValue =  xmlFunctions.getTagvalue(receiptTag, rule.request.receiptTag)
		receipt = receiptValue
		mockProcess = await db.collection('mockTemplates').find( {model: model, service: service, receipt: receipt} ).toArray()    
	}else{
		mockProcess = await db.collection('mockTemplates').find( {model: model, service: service} ).toArray()    
	}
	
	for(ntest = 0; ntest <  mockProcess.length; ntest++){
		regex = base64decode(mockProcess[ntest].request)
		regex = new RegExp(regex,'g')			
		if(request.match(regex)){
			retTestcase.mockProcess = mockProcess[ntest]
			return retTestcase.mockProcess
		}else{	
			var xmlReq			
			if(replaces.lote){
				xmlReq	= await xmlFunctions.replaceXML(request, replaces.lote, request)
			}
			if(replaces.doc){
				items = xmlFunctions.getNodeXml(xmlReq, rule.request.docRootTag, "complex")
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
			}else if(ntest === mockProcess.length-1){
				return retTestcase
			}
		}			
	}

	return retTestcase
}
/**
 * aplica regex na requisição para montagem dos templates
 * @param {*modelo do documento} model 
 * @param {*nome do metodo/serviço} service 
 * @param {*xml da requisicao} request 
 */
async function messageRequest(request, rule ){
	var replaces

	if(rule){
		if(rule.request && rule.request.replaces){			
			if(rule.request.replaces.lote){
				replaces = rule.request.replaces.lote
				request = await xmlFunctions.replaceXML(request, replaces)
			}			
			if(replaces = rule.request.replaces.doc){
				replaces = rule.request.replaces.doc
				items = xmlFunctions.getNodeXml(request, rule.request.docRootTag, "complex")
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

/**
 * prepara e registra os replaces de resposta para as requsições assincronas
 * @param {*modelo do documento} model 
 * @param {*numero do recibo na requisicao} receipt 
 * @param {*xml da requisicao} request 
 * @param {*xml do recibo da requisicao} receiptMessage 
 * @param {*tags para replace} replaces 
 * @param {*tag raiz do documento} reqRootTag 
 * @param {*tag raiz do recibo} retRootTag 
 */
async function prepareResponse(model, receipt, request, receiptMessage, replaces, reqRootTag, retRootTag){
	
	var response = {} 

	if(replaces.lote){		
		response.lote = await fillDocResp(replaces.lote, request, receiptMessage)
	}

	if(replaces.doc){				
		var itemsRequest = xmlFunctions.getNodeXml(request, reqRootTag, 'complex')
		var receiptItems = xmlFunctions.getNodeXml(receiptMessage, retRootTag, 'complex')
		var itemRequest
		var itemreceipt
		var temp
		response.doc = []
		for(docs = 0; docs < itemsRequest.length; docs++){			
			itemRequest = itemsRequest[docs]
			itemreceipt = receiptItems[0]
			if(receiptItems.length > docs){
				itemreceipt = receiptItems[docs]
			}
			temp = await fillDocResp(replaces.doc, itemRequest, itemreceipt)
			response.doc.push(temp)
		}		
	}
	result = await db.collection('responses')
					 .replaceOne({model: model, receipt: receipt}, 
						         {model: model, receipt: receipt, replaces: response }, 
								 {upsert:true})    
}


/**
 * monta objeto com os replaces para as requsições assincronas
 * @param {*tags pra replace} replaces 
 * @param {*xml da requisicao} request 
 * @param {*xml do recibo da requisicao} receiptMessage 
 */
async function fillDocResp(replaces, request, receiptMessage){

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
		if(from === 'receiptMessage') {     
			items = xmlFunctions.getNodeXml(receiptMessage, tag, type)
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
				if(from === 'receiptMessage') {     				
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

module.exports = {MockTemplates, getMockResponse}