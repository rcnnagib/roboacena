const functions = require('/roboacena/src/functions.js')
/**
 * CADASTRO DE REGRAS DE  E REPLACES PARA OS CASOS DE TESTES
 * @param {*} req 
 * @param {*} res 
 */
async function createRules(req, res){
	var result
	db = await functions.connectMongoDB(URL)
	result = await db.collection('rules').replaceOne( {model: req.model, service: req.service}, req, {upsert:true} )
	
	if(result.upsertedId){
		res.end( "Regra Registrado com sucesso") 	
	}else if(result.modifiedCount){
		res.end( "Regra atualizada com sucesso") 	
	}
}

/**
 * RETORNA REGRAS DO CASO DE TESTE
 * @param {*} model 
 * @param {*} service 
 */
async function getRules(model, service){
	var rule
	db = await functions.connectMongoDB(URL)
	rule = await db.collection('rules').findOne( {model: model, service: service} )
	if(rule){
		return rule
	}
}

module.exports = {createRules, getRules}