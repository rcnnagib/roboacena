
//FORMATA XML
function formatXML(request){
    request = request.replace(/&lt;/g,'<')
    request = request.replace(/&gt;/g,'>')
    request = request.replace(/&quot;/g,'"')
    request = request.replace(/(\s*<)/g, '<')
    return request
}

//APLICA REPLACES EM UM XML
async function replaceXML(xml, replaces, xmlRetRequest){
    var functions = require('/roboacena/src/functions.js')
    var tag
    var attribute
    var newValue
    var type

    for(replaceIndex = 0; replaceIndex <  replaces.length; replaceIndex++){
        if(replaces[replaceIndex].tag){
            tag = replaces[replaceIndex].tag
        }else{
            attribute = replaces[replaceIndex].attribute
        }

        if(replaces[replaceIndex].type){
            type = replaces[replaceIndex].type
        }        
        size = replaces[replaceIndex].size
        
        if(replaces[replaceIndex].value){                        
            newValue = replaces[replaceIndex].value
        }else if(replaces[replaceIndex].from === 'retRequest') {                        
            newValue = getNodeXml(xmlRetRequest, tag, type )
            newValue = getTagvalue(newValue, tag)
        }else if(replaces[replaceIndex].from ==='getDateTime'){            
            newValue = functions.getDateTime()
        }else if(replaces[replaceIndex].from ==='getRandomNumber'){
            newValue =  functions.getRandomNumber("1".repeat(size), "9".repeat(size))
        }                
        
        if(tag && newValue){
            xml = setNodeXml(xml, tag, newValue, type )
            tag = undefined
        }
        if(attribute && newValue){
            xml = setAttributeValue(xml, attribute, newValue )
            attribute = undefined
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
    node = getNodeXml(xml, tag, type)
    if(!node){
        return xml
    }
    newTag =  tagIni+ newValue + tagFin
    return xml.replace(node, newTag )
}

//RETORNA UM NO DE UM XML
function getNodeXml(xml, tag, type){
    var node
    var regex
    if(type === 'complex'){
        //regex = new RegExp('<([a-z]{0,}:)?' + tag + '.*>.*</([a-z]{0,}:)?' + tag + '>')    
        regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?\\w*(:\\w*)?(\\s*)?\\=(\\s*)?".*"(\\s*))?>.*<\/(\\w*:)?' + tag + '>')
    }else{
        //regex = new RegExp('<([a-z]{0,}:)?' + tag + '\s{0,}([aA-zZ]*\s{0,}=\s{0,}".*")?>[^<>]*<\/([a-z]{0,}:)?' + tag + '>')    
        regex = new RegExp('<(\\w*:)?' + tag + '((\\s*)?\\w*(:\\w*)?(\\s*)?\\=(\\s*)?".*"(\\s*))?>[^<>]*</(\\w*:)?' + tag + '>')
    }
    
    node = regex.exec(xml)
    if(!node){
        return ""
    }
    return node[0] 
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
            value = getNodeXml(xml, replaces[nReplaces].tag, replaces[nReplaces].type)
            value = getTagvalue(value, replaces[nReplaces].tag)            
            if(!regex.test(value)){
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

module.exports = {formatXML, replaceXML,  getNodeXml, getTagvalue, setAttributeValue, getAttributeValue, validTagRegex, getSoapFault}


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
    attribute = regex.exec(xml)
    if(attribute){
        attributevalue = attribute[0]
        attributevalue = attributevalue.replace( /.*=(\\s)?"/,'')
        attributevalue = attributevalue.replace(/"/,'')     
        return attributevalue
    }
    return ""
}