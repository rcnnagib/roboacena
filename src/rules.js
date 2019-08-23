//CADASTRO DE REGRAS DE  E REPLACES PARA OS CASOS DE TESTES
const functions = require('/roboacena/src/functions.js')
async function createRules(model, rule, req, res){
	var result
	db = await functions.connectMongoDB(URL)
	result = await db.collection('rules').replaceOne( {model: model, rule: rule}, req, {upsert:true} )
	
	if(result.upsertedId){
		res.end( "Regra Registrado com sucesso") 	
	}else if(result.modifiedCount){
		res.end( "Regra atualizada com sucesso") 	
	}
}

//RETORNA REGRAS DO CASO DE TESTE
async function getRules(model, service){
	var rule
	db = await functions.connectMongoDB(URL)
	rule = await db.collection('rules').find( {model: model, services: { $elemMatch:{ service: service} } }, {'services.$':1} ).toArray()
	if(rule && rule.length > 0){
		return rule[0].services[0]
	}
}

module.exports = {createRules, getRules}