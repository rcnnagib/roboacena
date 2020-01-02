/*Client = require("rpc-client");
//Client = require("jsonrpc-node").Client

client = new Client({host:"localhost",port:"5060", protocol:"TCP",envserver:"sped"});

client.call("TSSprocmanager", ["sped"], function(err, result){
    console.log("esse foi o resultado: " + result+ err)
})

*/


var xml = 'renato-renato'
var string = 'renato'
var regex = new RegExp('renato','g')
xml.match(regex)




getNodeXml(xml, 'Signature', 'complex')
//RETORNA UM NO DE UM XML
function getNodeXml(xml, tag, type){
    var node
    var regex
    
    var string = ''
    regexRootTag  = new RegExp('<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?(\"[^<]*\")?(\\s*))?>')
    rootTag = xml.match(regexRootTag)[0]
    if(type === 'complex'){
        cContent = '('
        for(i=0; rootTag.length > i; i++){                                            
            if(string.length != ''){
                cContent+='|'        
            }
            char = rootTag.slice(i,i+1)
            cContent += string + '[^'+char + ']'              
            string += char            
        }
        cContent += ')*'
        
        regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?(\"[^<]*\")?(\\s*))?>'+cContent+'<\/(\\w*:)?' + tag + '>','g')
    }else{        
        regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?\\w*(:\\w*)?(\\s*)?\\=(\\s*)?".*"(\\s*))?>[^<>]*</(\\w*:)?' + tag + '>')
    }
    
    node = xml.match(regex)
    if(!node){
        return [""]
    }
    return node
}