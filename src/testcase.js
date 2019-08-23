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
	req.request =  base64encode(await messageRequest(req.model, req.service, req.request))

	result = await db.collection('testcases').replaceOne({testcase:testcase, service: req.service}, req, {upsert:true})
	
	if(result.upsertedId){
		console.log('Registrado caso de teste: \n' + req.request)
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
	var retRequest
	var response

	db = await functions.connectMongoDB(URL)
	
	rule = await rules.getRules(req.headers.model, req.headers.service)

	if( rule && rule.request && rule.request.replaces){
		requestReplaces = rule.request.replaces
	}

	testcase = await getTestCase(req.headers.testcase, req.headers.model, req.headers.service, req.body, requestReplaces)

	res.writeHead(200, {"Content-Type": "text/xml"});
	
	if(testcase.regexError){									
		console.log("code: "+ testcase.regexError.code + "\nError:" + testcase.regexError.error + "\ntestcase:" + req.headers.testcase)
		res.end(xmlFunctions.getSoapFault(testcase.regexError.code, testcase.regexError.error))
		return		
	}

	if(rule && rule.request && rule.request.mode === 'async'){		
		retRequest = base64decode(testcase.response)
		retRequest =await xmlFunctions.replaceXML(retRequest, rule.retRequest.replaces)
		await prepareResponse(req.headers.model, req.headers.testcase, req.body, retRequest, rule.response.replaces)
		res.end(retRequest)	
	}else{
		response = base64decode(testcase.response)
		resReplaces = await db.collection('responses').find({model: req.headers.model, testcase: req.headers.testcase} ).toArray();				
		if(resReplaces && resReplaces.length > 0){
			response = await xmlFunctions.replaceXML(response, resReplaces[0].replaces)
		}else if(rule && rule.response && rule.response.replaces){
			response = await xmlFunctions.replaceXML(response, rule.response.replaces)
		}
		console.log('returning testcase response\n' + req.body)
		res.end(response)
	}
}

module.exports = {registerTestCase, procTestCase}

//RETORNA CASO DE TESTE 
async function getTestCase(testcaseId, model, service, request, replaces){
	var retTestcase = {testcase: null, regexError: {code: "404", error: "Testcase not found"} }
	var testcase
	var regex	

	request = xmlFunctions.formatXML(request)	
	if(testcaseId){
		testcase = await db.collection('testcases').find( {model: model, service: service, testcase: testcaseId} ).toArray()    
		if(!testcase || testcase.length === 0){					
			return retTestcase
		}	
		regex = new RegExp(testcase[0].request,'g')
		if( !regex.exec(request)){
			console.log('caso de teste com falha' )	
			retTestcase.regexError.code = "400"
			retTestcase.regexError.error = xmlFunctions.validTagRegex(request, replaces)
			return	retTestcase
		}
		return retTestcase.testcase = testcase[0]		
	}else{
		testcase = await db.collection('testcases').find( {model: model, service: service} ).toArray()    
		for(ntest = 0; ntest <  testcase.length; ntest++){
			regex = base64decode(testcase[ntest].request)
			regex = regex.replace(/\?/g,'\\?')
			regex = regex.replace(/\|/g,'\\|')
			//regex = regex.replace(/\./g,'\\.')
			regex = new RegExp(regex, 'g')			
			request.match(regex)
			if(regex.exec(request)){
				retTestcase.testcase = testcase[ntest]
				return retTestcase.testcase
			}else{
				faultString = xmlFunctions.validTagRegex(request, replaces)
				if(faultString){
					retTestcase.regexError.code = "400"
					retTestcase.regexError.error = faultString
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
			replaces = rule[0].services[0].request.replaces			
			request = await xmlFunctions.replaceXML(request,replaces)
		}
	}	
	return request
}

async function prepareResponse(model, testcase, request, retRequest, replaces){
	var replaceIndex
	var fields = []
    for(replaceIndex = 0; replaceIndex < replaces.length; replaceIndex++){    
        var tag = replaces[replaceIndex].tag
        var attribute = replaces[replaceIndex].attribute
        var size = replaces[replaceIndex].size
        var from = replaces[replaceIndex].from
		var tagToReplace
		var type = replaces[replaceIndex].type
		let newValue

        if(from === 'retRequest') {     
            tagToReplace  = xmlFunctions.getNodeXml(retRequest, tag, type)       
            newValue = xmlFunctions.getTagvalue(tagToReplace, tag)
        }else if(from === 'request'){            
            newValue = xmlFunctions.getAttributeValue(request, attribute)
			newValue = newValue.replace('NFe',"")
			newValue = newValue.replace('CTe',"")
			newValue = newValue.replace('MDFe',"")			
        }else if(from == 'getDate'){
            newValue = functions.getDateTime()
        }else if(from ==='getRandomNumber'){
            newValue = functions.getRandomNumber("1".repeat(size), "9".repeat(size))
        }
        fields.push({tag: tag, value: newValue } )         
	}

	result = await db.collection('responses')
					 .replaceOne({model: model, testcase:testcase}, 
						         {model: model, testcase: testcase, replaces: fields }, 
								 {upsert:true})    
}
