
//FORMATA XML
function formatXML(request){
    request = request.replace(/&lt;/g,'<')
    request = request.replace(/&gt;/g,'>')
    request = request.replace(/&quot;/g,'"')
    request = request.replace(/(\s*<)/g, '<')
    request = request.replace(/\n/g, '')
    return request
}

//APLICA REPLACES EM UM XML
async function replaceXML(xml, replaces, xmlRequest){
    var functions = require('/roboacena/src/functions.js')    
    var newValue    

    for(replaceIndex = 0; replaceIndex <  replaces.length; replaceIndex++){                        
        if(replaces[replaceIndex].value){
            if(replaces[replaceIndex].type !== "complex"){
                newValue = replaces[replaceIndex].value    
            }else{
                newValue = getComplexRegex(xml, replaces[replaceIndex].tag)
            }                            
        }else if(replaces[replaceIndex].from === 'request'){
            newValue = getNodeXml(xml, replaces[replaceIndex].tag, replaces[replaceIndex].type )[0]
            newValue = getTagvalue(newValue, replaces[replaceIndex].tag)
        }else if(replaces[replaceIndex].from === 'retRequest'){
            newValue = getNodeXml(xmlRequest, replaces[replaceIndex].tag, replaces[replaceIndex].type )[0]            
            newValue = getTagvalue(newValue, replaces[replaceIndex].tag)            
        }else if(replaces[replaceIndex].from ==='getDateTime'){            
            newValue = functions.getDateTime()
        }else if(replaces[replaceIndex].from ==='getRandomNumber'){
            newValue =  functions.getRandomNumber("1".repeat(replaces[replaceIndex].size), "9".repeat(replaces[replaceIndex].size))
        }                        
        if(replaces[replaceIndex].tag && newValue){
            xml = setNodeXml(xml, replaces[replaceIndex].tag, newValue, replaces[replaceIndex].type )
        }
        if(replaces[replaceIndex].attribute && newValue){
            xml = setAttributeValue(xml, replaces[replaceIndex].attribute, newValue )
            newValue = null
        }
    }
    return xml
}

//APLICA O REPLACE DE UMA TAG NO XML
function setNodeXml(xml, tag, newValue, type ){
    var node
    var tagIni
    var tagFin
    var newTag
    
    tagIni = getTagIni(xml, tag)
    if(!tagIni){
        return xml
    }
    tagFin = getTagFin(xml, tag)
    if(!tagFin){
        return xml
    }
    node = getNodeXml(xml, tag, type)[0]
    if(!node){
        return xml
    }
    newTag =  tagIni+ newValue + tagFin
    return xml.replace(node, newTag )
}

function getNodeXml(xml, tag, type){
    var node
    var regex
    var string = ''
    //xml ="<retEnviCte versao='3.00' xmlns='http://www.portalfiscal.inf.br/cte'>"
    regexRootTag  = new RegExp('<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(\\:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?.([^<]*)?(\\s*)?.)?>')
    rootTag = xml.match(regexRootTag)
    
    if(rootTag === null){
        return [""]   
    }
    rootTag = rootTag[0]
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
        
        regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(\\:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?.([^<]*)?(\\s*))?>'+cContent+'<\/(\\w*:)?' + tag + '>','g')
    }else{        
        regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?\\w*(:\\w*)?(\\s*)?\\=(\\s*)?".*"(\\s*))?>[^<>]*</(\\w*:)?' + tag + '>','g')
    }
    
    node = xml.match(regex)
    if(!node){
        return [""]
    }
    return node
}
//RETORNA VALOR DE UMA TAG
function getTagvalue(tagValue,tag){
    var tagIni
    var tagFin
    var value
    tagIni = getTagIni(tagValue, tag)
    tagFin = getTagFin(tagValue, tag)
    value = tagValue.replace(tagIni, "")
    value = value.replace(tagFin, "")
    return value
}

//RETORNA TAG INICIAL
function getTagIni(xml, tag){
    var regex
    var tagIni
    regex = new RegExp('<' + tag + '(([\\s]{0,})?[aA-zZ]{1,}([\\s]{0,})?\=([\\s]{0,})?"[^<]{0,}")?(?=>)','g')                
    tagIni = regex.exec(xml)
    if(tagIni){
        return tagIni[0] + '>'
    }
    return ""
}

//RETORNA TAG FINAL
function getTagFin(xml, tag){
    var regex
    var tagFin
    regex = new RegExp('</([a-z]*:)?'+tag+'>','g')
     tagFin = regex.exec(xml)    
    if(tagFin){
        return tagFin[0]        
    }
    return ""
}

function validTagRegex(xml, replaces){
    var nReplaces
    var value
    var faultString = ''
    var tag
    var attribute
    
    if(!replaces){
        return faultString 
    }
    
    for(nReplaces = 0; nReplaces < replaces.length; nReplaces++){
        regex = new RegExp(replaces[nReplaces].value, 'g')
        if(replaces[nReplaces].tag){
            tag = replaces[nReplaces].tag
            value = getNodeXml(xml, replaces[nReplaces].tag, replaces[nReplaces].type)[0]
            value = getTagvalue(value, replaces[nReplaces].tag)            
            if(value.length > 0 && !regex.test(value)){
                faultString += "ERROR: Element '" + tag + "': [facet 'pattern'] The value '" + value + "' is not accepted by the pattern '"+ regex.source + "'.\n"
                 
            }
        }else if(replaces[nReplaces].attribute){
            attribute = replaces[nReplaces].attribute            
            value = getAttributeValue(xml,attribute)
            if(!regex.test(value)){
                faultString += "ERROR: attribute '" + attribute + "': '" + value + "' is not a valid value of the local atomic type: " +regex.source
            }
        }                
    }    
    return faultString 
}

//MENSAGEM DE SOAP FAULT
function getSoapFault(code, faultString){
	soap ='<SOAP-ENV:Envelope'
	soap +=' xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"'
	soap +=' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
	soap +=' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
	soap +=' xmlns:f="http://www.w3.org/2001/12/soap-faults">'
	soap +=' <SOAP-ENV:Body>'
	soap +=' <SOAP-ENV:Fault>'
	soap +=' <faultcode>'+code+'</faultcode>'
	soap +=' <faultstring>'+faultString+ '</faultstring>'
	soap +=' </SOAP-ENV:Fault>'
	soap +=' </SOAP-ENV:Body>'
	soap +=' </SOAP-ENV:Envelope>'
	return soap
}

module.exports = {formatXML, replaceXML,  getNodeXml, getTagvalue, setAttributeValue, getAttributeValue, validTagRegex, getSoapFault, applyRegexScapes}


//APLICA O REPLACE DE UMA TAG NO XML
function setAttributeValue(xml, attribute, newValue ){
    
    var attributevalue =  getAttributeValue(xml, attribute)            
    if(attributevalue){
        return xml.replace(attributevalue, newValue)
    }
    return xml
}

function getAttributeValue(xml, attribute){
    var regex = new RegExp(attribute + '(\\s)?=(\\s)?"[^>\\s]*','g')
    var attributevalue = [""]
    attribute = xml.match(regex)
    if(attribute){
        attributevalue = attribute[0]
        attributevalue = attributevalue.replace( /.*=(\\s)?"/,'')
        attributevalue = attributevalue.replace(/"/,'')     
        return attributevalue
    }
    return attributevalue
}


function getComplexRegex(xml, tag){
    var regex
    var string = ''
    regexRootTag  = new RegExp('<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?(\"[^<]*\")?(\\s*))?>')
    rootTag = xml.match(regexRootTag)[0]
    
    cContent = '('
    for(i=0; rootTag.length > i; i++){                                            
        if(string.length != ''){
            cContent+='|'        
            //cContent+='|'        
        }
        char = rootTag.slice(i,i+1)
        cContent += string + '[^'+char + ']'              
        string += char            
    }
    cContent += ')*'
    
    //regex = '<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?("[^<]*")?(\\s*))?>'+cContent+'</(\\w*:)?' + tag + '>'
    //regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?(\\w*)?(:)?(\\w*)?(\\s*)?(\\=)?(\\s*)?(\"[^<]*\")?(\\s*))?>'+cContent+'<\/(\\w*:)?' + tag + '>','g')

    return cContent
}


function applyRegexScapes(content){
    content = content.replace(/\?/g,'\\?')
	content = content.replace(/\*/g,'\\*')
	content = content.replace(/\+/g,'\\+')
	content = content.replace(/\-/g,'\\-')
	content = content.replace(/\^/g,'\\^')
	content = content.replace(/\$/g,'\\$')
	content = content.replace(/\|/g,'\\|')
	content = content.replace(/\[/g,'\\[')
	content = content.replace(/\]/g,'\\]')
	content = content.replace(/\{/g,'\\{')
	content = content.replace(/\}/g,'\\}')
	content = content.replace(/\(/g,'\\(')
    content = content.replace(/\)/g,'\\)')

    return content
}