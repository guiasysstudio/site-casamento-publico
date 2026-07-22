function removeAccents(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function sanitize(value,max){return removeAccents(value).toUpperCase().replace(/[^A-Z0-9 $%*+\-./:]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function tlv(id,value){const text=String(value);return `${id}${String(text.length).padStart(2,"0")}${text}`}
function crc16(payload){let crc=0xffff;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xffff}return crc.toString(16).toUpperCase().padStart(4,"0")}
export function buildPixPayload({key,name,city,amount,description="",txid="***"}){
  const merchant=tlv("00","BR.GOV.BCB.PIX")+tlv("01",String(key).trim())+(description?tlv("02",sanitize(description,72)):"");
  let payload=tlv("00","01")+tlv("26",merchant)+tlv("52","0000")+tlv("53","986");
  const value=Number(amount);if(Number.isFinite(value)&&value>0)payload+=tlv("54",value.toFixed(2));
  payload+=tlv("58","BR")+tlv("59",sanitize(name,25))+tlv("60",sanitize(city,15))+tlv("62",tlv("05",sanitize(txid,25)||"***"))+"6304";
  return payload+crc16(payload);
}
