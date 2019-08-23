zipFile()

async function zipFile(){
    var fs = require('fs');
    var zip = new require('node-zip')();
    var data
    
    
    pdf = await fs.readFileSync('/roboacena/files/danfe_00000120190614174846.pdf'),
    zip.file('555001124.pdf', pdf);
    
    data = zip.generate({base64:true,compression:'DEFLATE'});
    
    console.log(data); // ugly data        
}