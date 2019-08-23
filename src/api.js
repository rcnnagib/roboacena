var cluster = require('cluster');
/*if(cluster.isMaster) {
    var numWorkers = require('os').cpus().length;

    console.log('Master cluster setting up ' + numWorkers + ' workers...');

    for(var i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    cluster.on('online', function(worker) {
        console.log('Worker ' + worker.process.pid + ' is online');
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        console.log('Starting a new worker');
        cluster.fork();
    });

} else {	*/
	var https = require('https');
	var http = require('http');
	var express = require('express');
	var app = express();	
	var bodyParser = require('body-parser');
	var fs = require('fs');
	var options = {key: fs.readFileSync('/roboacena/server.key'),cert: fs.readFileSync('/roboacena/server.cert')};//passphrase: 'totvs@2018' 
	var urlencodedParser = bodyParser.urlencoded({ extended: true })
	var port = 8000;
	var porthttp = 8083;
	var rules = require('/roboacena/src/rules.js')
	var testcase = require('/roboacena/src/testcase.js')
	
	var server = https.createServer(options, app).listen(port, function(){
		console.log("Express server https listening on port " + port);
	});
	/*
	var server = http.createServer(app).listen(porthttp, function(){
		console.log("Express server https listening on port " + port);
	});
*/
	//VALIDACAO E PROCESSAMENTO DE CASOS DE TESTES
	app.post(/automacao-async/,bodyParser.text({type:'*/*'}),function (req, res) {
		console.log("recebendo requisicao:\n servico:" + req.headers.service + "\nmodelo: " + req.headers.model)	
		testcase.procTestCase(req, res)
	})

	//INCLUSAO DOS CASOS DE TESTES
	app.post('/automacao/testcases/',bodyParser.json() ,function(req, res, next){		
		testcase.registerTestCase(req.body, res)
	})

	//CADASTRO DE REGRAS DE SCAPES E REPLACES
	app.post('/automacao/templates/rules/',bodyParser.json() ,function(req, res, next){		
		rules.createRules(req.body.model, req.body.rule, req.body, res)			
	})
	//RETORNA ARQUIVOS
	app.use('/simulador', urlencodedParser, function (req, res) {		
		res.writeHead(200, {"Content-Type": "text/xml"});
		retFile = req.query.file +'.' + req.query.type
		setTimeout(function() {
		res.end(fs.readFileSync('/roboacena/xml_files/' + retFile));
		console.log('Retornando o arquivo : ' + retFile)},1000   )
	})    
	
	//RETORNA ARQUIVOS
	app.use('/SPEDADM.apw', urlencodedParser, function (req, res) {		
		//res.writeHead(500, {"Content-type": "text/xml"});
		
		res.writeHead(200, {"#status#": "Internal Server Error",		
		"Server": "Protheus Web Server",
		"MIME-version": "1.0",
		"Content-type": "text/xml",
		"Last-modified": "Thu, 18 Jul 2019 12:31:12 GMT",
		"Set-cookie": "SESSIONID=2c19f83d3c184c92a246d1650dc84599",
		"XAPWSBUILD": "ADVPL WSDL Server 1.110216",
		"X-Frame-Options": "SAMEORIGIN",
		//"Content-Length": "476"
	})		

	//valida assinatura
	app.use('/SPEDADM.apw', urlencodedParser, function (req, res) {		
		
		res.writeHead(200, {"#status#": "Internal Server Error",		
		"Server": "Protheus Web Server",
		"MIME-version": "1.0",
		"Content-type": "text/xml",
		"Last-modified": "Thu, 18 Jul 2019 12:31:12 GMT",
		"Set-cookie": "SESSIONID=2c19f83d3c184c92a246d1650dc84599",
		"XAPWSBUILD": "ADVPL WSDL Server 1.110216",
		"X-Frame-Options": "SAMEORIGIN",
		//"Content-Length": "476"
		
	})
	var encrypted

	const NodeRSA = require('node-rsa');
	const key = new NodeRSA('-----BEGIN PUBLIC KEY-----\n'+
	'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlqd5senRJNMonQ7UMsB5\n'+
	'mlB4fT1iIOT6K69dRe/hvTNcCkmaKOIIi9d/nuFn98Gii4v5m9YP3Yuz02gw4Z2H\n'+
	'vwV+7jnNJDDiq8dmE7NatTyglDVWSMYA6seyF33NQE8PtHAYYc4z/4ZnIJ9Vaodi\n'+
	'y4opo1tVpusAjMAZo65m71+LhMKsmcm6+XeScS16Jt9U8TDXmSdKzeig542Szhy5\n'+
	'H2FrAuiuzuIcGsG9HyFnhCRGyi1mB7vjUzlN/m1ifXVyh1RqgAhq787FzQ5aYGCZ\n'+
	'jhsZlcNkZ57YsAhhl29IJokpFDAO/ChtgTCsqHbIy2inxtJXK7tN1/kxhWrVRWxS\n'+
	'mwIDAQAB\n'+
	'-----END PUBLIC KEY-----');
	const decrypted = key.decrypt(encrypted, 'utf8');
	console.log('decrypted: ', decrypted);

	res.end("validado");		
	})    
//}