global.URL = 'mongodb://127.0.0.1:27017/automacao';
global.db
//RETORNA DATA FORMATO UTC
function getDateTime(){
    var date = new Date()                        
    var dateTime = date.toISOString()
    utc = date.getTimezoneOffset() / 60
    dateTime = dateTime.slice(0, 19)
    dateTime += '-0' + utc + ':00'
    return dateTime
}  

//GERA NUMERO RANDOMICO
function getRandomNumber (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}  

//CONECTA NO MONGO
async function connectMongoDB(){
	var mongodb = require('mongodb')
	var MongoClient = mongodb.MongoClient
	return  await MongoClient.connect(URL)
}

module.exports = {getDateTime, getRandomNumber, connectMongoDB }