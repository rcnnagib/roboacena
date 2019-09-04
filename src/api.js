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

	//CADASTRO DE REGRAS DE SCAPES E REPLACES
	app.get('/automacao/templates/rules/',bodyParser.json() ,function(req, res, next){		
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
	
//}