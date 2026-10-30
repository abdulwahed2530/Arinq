/* Local footage selection only. No OAuth or uploads. */
(()=>{
const video=f=>/\.(mp4|mov|m4v|webm|mkv|avi|mts|m2ts)$/i.test(f.name);
let selected=[];
function refreshLocalSelection(){$('addBatch').textContent='เพิ่มรายการเหล่านี้เข้าคิว';$('batchRootPath').disabled=false;$('batchPathHelp').textContent='พาธไม่บังคับสำหรับจัดคิว แต่ AutoGen ต้องมีพาธจริงก่อนเรนเดอร์ ไฟล์ไม่ได้ถูกอัปโหลด';}
const status=t=>{$('sourceStatus').textContent=t};
const oldSelect=$('batchFolderInput').onchange;
$('batchFolderInput').onchange=e=>{selected=Array.from(e.target.files).filter(video);oldSelect(e);if(!selected.length)return;refreshLocalSelection()};
$('chooseVideoFiles').onclick=()=>{if(editing!==null)return toast('บันทึกหรือยกเลิกการแก้ไขก่อน');$('videoFilesInput').value='';$('videoFilesInput').click()};
$('videoFilesInput').onchange=e=>{selected=Array.from(e.target.files).filter(video);if(!selected.length)return toast('ไม่พบวิดีโอ');const groups=new Map();for(const f of selected){const name=f.name.replace(/\.[^.]+$/,'');groups.set(name,(groups.get(name)||0)+1)}batchScan={root:'ไฟล์ที่เลือก',rootVideos:0,groups:[...groups],loose:true};$('batchRootPath').value='';$('batchSummary').textContent='เลือก '+selected.length+' ไฟล์ • แต่ละชื่อไฟล์เป็นสินค้า';$('batchList').textContent=batchScan.groups.map(([n,c])=>n+' — '+c+' วิดีโอ').join('\n');refreshLocalSelection();$('batchDialog').showModal()};
function localGroups(){return batchScan.groups.map(([name])=>({name,files:selected.filter(f=>batchScan.loose?f.name.replace(/\.[^.]+$/,'')===name:(f.webkitRelativePath||'').split('/')[1]===name)}))}
function settings(){updateScriptStyle();const duration=Number($('duration').value);if(!Number.isFinite(duration)||duration<5||duration>180)throw Error('ระบุความยาว 5–180 วินาที');return {...audioSettings(),subtitleMotion:$('subtitleMotion').value,subtitleMode:$('subtitleMode').value,subtitleFont:$('subtitleFont').value,voiceMode:$('voiceMode').value,theme:$('theme').value,scriptStyle:scriptStyleKey($('scriptStyle').value),selling:$('selling').value.trim(),duration}}

const oldAdd=$('addBatch').onclick;
$('addBatch').onclick=()=>{
if(!batchScan)return;const path=$('batchRootPath').value.trim();if(path&&!batchScan.loose)return oldAdd();
try{const defaults=settings(),groups=localGroups();if(state.jobs.length+groups.length>300)throw Error('รวมได้ไม่เกิน 300 คิว');let added=0;
for(const group of groups){const destination='local-selection://'+encodeURIComponent(batchScan.root)+'/'+encodeURIComponent(group.name);if(!state.jobs.some(j=>j.folder===destination)){state.jobs.push({...defaults,output:$('output').value,product:productNameFromFolder(group.name),folder:destination,sourceMode:'local',sourceFiles:group.files.map(f=>({name:f.name,size:f.size,relativePath:f.webkitRelativePath||f.name})),sourceStatus:'needs-local-path'});added++;}}
persist();render();status('เพิ่ม '+added+' คิวแล้ว • ต้องระบุพาธจริงให้ AutoGen ก่อนเรนเดอร์');$('batchFolderStatus').textContent=$('sourceStatus').textContent;$('batchDialog').close();batchScan=null;toast('เพิ่มคิวแล้ว');
}catch(e){$('batchSummary').textContent=e.message;status(e.message)}};
const originalPrompt=promptText;
promptText=function(){const sources=state.jobs.filter(j=>j.sourceMode).map(j=>({product:j.product,mode:j.sourceMode,status:j.sourceStatus,folder:j.folder,files:j.sourceFiles||[]}));return originalPrompt()+(sources.length?'\n\nข้อมูลแหล่งวิดีโอ:\n'+JSON.stringify(sources,null,2)+'\nแหล่ง local-selection เป็นชื่อไฟล์อ้างอิง ไม่ใช่พาธจริง ห้ามเดาพาธหรือเรนเดอร์จนกว่าจะพบไฟล์จริง แหล่ง Google Drive ต้องดาวน์โหลด/ซิงก์ไฟล์ที่ได้รับอนุญาตเข้าถึงมายังเครื่อง AutoGen แล้วตรวจไฟล์ก่อนใช้ ลิงก์ไม่ทำให้ไฟล์เป็นสาธารณะ หากบัญชีเครื่องเรนเดอร์เข้าไม่ได้ให้ข้ามคิวและรายงาน ห้ามอ้างว่าไฟล์พร้อมเรนเดอร์เพียงเพราะอัปโหลดแล้ว':'')};

refreshLocalSelection();
})();
