/* Browser-local selection + Google Drive upload. Tokens stay in memory. */
(()=>{
const video=f=>/\.(mp4|mov|m4v|webm|mkv|avi|mts|m2ts)$/i.test(f.name);
let selected=[],token='',expires=0,busy=false,uploaded=new Map(),gisPromise;
const mode=()=>$('sourceMode').value;
const status=t=>{$('sourceStatus').textContent=t};
$('driveClientId').value=localStorage.getItem('arin-drive-client-id')||'777928250787-8feblmc1rmq29pu9to12tnl4iuklvlqn.apps.googleusercontent.com';
$('driveClientId').onchange=()=>localStorage.setItem('arin-drive-client-id',$('driveClientId').value.trim());
$('sourceMode').onchange=()=>{const cloud=mode()==='drive';$('driveConnection').hidden=!cloud;$('addBatch').textContent=cloud?'อัปโหลดเข้า Drive แล้วเพิ่มคิว':'เพิ่มรายการเหล่านี้เข้าคิว';$('batchRootPath').disabled=cloud;$('batchPathHelp').textContent=cloud?'ไม่ต้องกรอกพาธ ไฟล์จะถูกส่งเข้าโฟลเดอร์ ARIN Uploads ใน Google Drive ของคุณ':'พาธไม่บังคับสำหรับจัดคิว แต่ AutoGen ต้องมีพาธจริงก่อนเรนเดอร์ ไฟล์ไม่ได้ถูกอัปโหลดในโหมดนี้';};
function gis(){if(window.google?.accounts?.oauth2)return Promise.resolve();if(!gisPromise)gisPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>{gisPromise=null;reject(Error('โหลดระบบ Google ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'))};document.head.append(s)});return gisPromise}
$('connectDrive').onclick=async()=>{try{if(location.protocol==='file:')throw Error('เชื่อม Google ผ่านเว็บ HTTPS หรือ localhost เท่านั้น เปิดเว็บ Vercel ก่อน');const id=$('driveClientId').value.trim();if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('กรอก OAuth Client ID ของแอปก่อน');localStorage.setItem('arin-drive-client-id',id);await gis();google.accounts.oauth2.initTokenClient({client_id:id,scope:'https://www.googleapis.com/auth/drive.file',callback:r=>{if(r.error){status('เชื่อมต่อไม่สำเร็จ: '+r.error);return}token=r.access_token;expires=Date.now()+Number(r.expires_in||3600)*1000;status('เชื่อมต่อ Google Drive แล้ว พร้อมอัปโหลด');$('disconnectDrive').hidden=false},error_callback:()=>status('ยกเลิกหรือเปิดหน้าต่างเข้าสู่ระบบไม่ได้ กรุณาลองใหม่')}).requestAccessToken({prompt:'consent'})}catch(e){status(e.message)}};
$('disconnectDrive').onclick=()=>{if(busy)return status('รอให้อัปโหลดเสร็จก่อนตัดการเชื่อมต่อ');if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';expires=0;$('disconnectDrive').hidden=true;status('ตัดการเชื่อมต่อแล้ว')};
function auth(){if(!token||Date.now()>expires-30000)throw Error('กรุณากดเชื่อมต่อ Google Drive ก่อนอัปโหลด (การเชื่อมต่ออาจหมดอายุ)')}
async function api(url,init={}){auth();const r=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...init.headers}});if(!r.ok){let message='';try{message=(await r.json()).error?.message||''}catch{}throw Error('Google Drive '+r.status+': '+message)}return r}
async function folder(name,parent){const r=await api('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})})});return r.json()}
async function upload(file,parent,onprogress){
 const r=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,webViewLink',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':file.type||'application/octet-stream','X-Upload-Content-Length':String(file.size)},body:JSON.stringify({name:file.name,parents:[parent]})});
 const url=r.headers.get('Location');if(!url)throw Error('Drive ไม่คืนที่อยู่อัปโหลด');const session=new URL(url);if(session.protocol!=='https:'||session.hostname!=='www.googleapis.com')throw Error('ที่อยู่อัปโหลดไม่ถูกต้อง');
 const chunk=8*1024*1024;let offset=0;
 while(offset<file.size){auth();const end=Math.min(file.size,offset+chunk);let res;try{res=await fetch(url,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':file.type||'application/octet-stream','Content-Range':`bytes ${offset}-${end-1}/${file.size}`},body:file.slice(offset,end)})}catch{throw Error('อินเทอร์เน็ตขัดข้องระหว่างอัปโหลด '+file.name+' กรุณาลองใหม่')}
 if(res.status===308){const range=res.headers.get('Range');const next=range?Number(range.split('-').pop())+1:end;if(next<=offset)throw Error('อัปโหลดไม่คืบหน้า กรุณาลองใหม่');offset=next;onprogress(offset);continue}
 if(!res.ok)throw Error('อัปโหลด '+file.name+' ไม่สำเร็จ ('+res.status+')');const out=await res.json();onprogress(file.size);return out;
 }throw Error('ไฟล์ว่างหรืออัปโหลดไม่สมบูรณ์');
}
const oldSelect=$('batchFolderInput').onchange;
$('batchFolderInput').onchange=e=>{selected=Array.from(e.target.files).filter(video);uploaded=new Map();oldSelect(e);if(!selected.length)return;$('sourceMode').onchange()};
$('chooseVideoFiles').onclick=()=>{if(editing!==null)return toast('บันทึกหรือยกเลิกการแก้ไขก่อน');$('videoFilesInput').value='';$('videoFilesInput').click()};
$('videoFilesInput').onchange=e=>{selected=Array.from(e.target.files).filter(video);uploaded=new Map();if(!selected.length)return toast('ไม่พบวิดีโอ');const groups=new Map();for(const f of selected){const name=f.name.replace(/\.[^.]+$/,'');groups.set(name,(groups.get(name)||0)+1)}batchScan={root:'ไฟล์ที่เลือก',rootVideos:0,groups:[...groups],loose:true};$('batchRootPath').value='';$('batchSummary').textContent='เลือก '+selected.length+' ไฟล์ • แต่ละชื่อไฟล์เป็นสินค้า';$('batchList').textContent=batchScan.groups.map(([n,c])=>n+' — '+c+' วิดีโอ').join('\n');$('sourceMode').onchange();$('batchDialog').showModal()};
function localGroups(){return batchScan.groups.map(([name])=>({name,files:selected.filter(f=>batchScan.loose?f.name.replace(/\.[^.]+$/,'')===name:(f.webkitRelativePath||'').split('/')[1]===name)}))}
function settings(){updateScriptStyle();const duration=Number($('duration').value);if(!Number.isFinite(duration)||duration<5||duration>180)throw Error('ระบุความยาว 5–180 วินาที');return {subtitleMode:$('subtitleMode').value,subtitleFont:$('subtitleFont').value,voiceMode:$('voiceMode').value,theme:$('theme').value,scriptStyle:scriptStyleKey($('scriptStyle').value),selling:$('selling').value.trim(),duration}}
const oldAdd=$('addBatch').onclick;
$('addBatch').onclick=async()=>{
 if(!batchScan||busy)return;const path=$('batchRootPath').value.trim();if(mode()==='local'&&path&&!batchScan.loose)return oldAdd();
 try{const defaults=settings(),groups=localGroups();if(state.jobs.length+groups.length>300)throw Error('รวมได้ไม่เกิน 300 คิว');if(mode()==='drive')auth();busy=true;$('addBatch').disabled=true;$('closeBatch').disabled=true;$('sourceMode').disabled=true;$('connectDrive').disabled=true;let added=0;
 for(const group of groups){
  let destination,files=[],sourceMode=mode();
  if(sourceMode==='drive'){
   let item=uploaded.get(group.name);if(!item){if(!uploaded.has('__root'))uploaded.set('__root',await folder('ARIN Uploads '+new Date().toISOString().replace(/[:.]/g,'-')));const fd=await folder(group.name,uploaded.get('__root').id);item={folder:fd,files:new Map()};uploaded.set(group.name,item)}
   for(let i=0;i<group.files.length;i++){const f=group.files[i],key=f.webkitRelativePath||f.name;if(!f.size)throw Error('ไฟล์ว่าง: '+f.name);if(!item.files.has(key)){const result=await upload(f,item.folder.id,n=>{$('batchSummary').textContent=group.name+' • '+(i+1)+'/'+group.files.length+' • '+Math.round(n/f.size*100)+'%';status('กำลังอัปโหลด '+f.name)});item.files.set(key,{...result,relativePath:key})}files.push(item.files.get(key))}destination='https://drive.google.com/drive/folders/'+item.folder.id;
  }else{destination='local-selection://'+encodeURIComponent(batchScan.root)+'/'+encodeURIComponent(group.name);files=group.files.map(f=>({name:f.name,size:f.size,relativePath:f.webkitRelativePath||f.name}))}
  if(!state.jobs.some(j=>j.folder===destination)){state.jobs.push({...defaults,product:productNameFromFolder(group.name),folder:destination,sourceMode,sourceFiles:files,sourceStatus:sourceMode==='drive'?'uploaded':'needs-local-path'});added++;persist();render()}
 }
 status(mode()==='drive'?'อัปโหลดสำเร็จและเพิ่ม '+added+' คิว • ต้องดาวน์โหลด/ซิงก์ให้เครื่อง AutoGen ก่อนเรนเดอร์':'เพิ่ม '+added+' คิวแล้ว • ยังต้องระบุพาธจริงให้ AutoGen ก่อนเรนเดอร์');$('batchFolderStatus').textContent=$('sourceStatus').textContent;$('batchDialog').close();batchScan=null;toast('เพิ่มคิวแล้ว');
 }catch(e){$('batchSummary').textContent=e.message;status(e.message)}finally{busy=false;$('addBatch').disabled=false;$('closeBatch').disabled=false;$('sourceMode').disabled=false;$('connectDrive').disabled=false}
};
const originalPrompt=promptText;
promptText=function(){const sources=state.jobs.filter(j=>j.sourceMode).map(j=>({product:j.product,mode:j.sourceMode,status:j.sourceStatus,folder:j.folder,files:j.sourceFiles||[]}));return originalPrompt()+(sources.length?'\n\nข้อมูลแหล่งวิดีโอ:\n'+JSON.stringify(sources,null,2)+'\nแหล่ง local-selection เป็นชื่อไฟล์อ้างอิง ไม่ใช่พาธจริง ห้ามเดาพาธหรือเรนเดอร์จนกว่าจะพบไฟล์จริง แหล่ง Google Drive ต้องดาวน์โหลด/ซิงก์ไฟล์ที่ได้รับอนุญาตเข้าถึงมายังเครื่อง AutoGen แล้วตรวจไฟล์ก่อนใช้ ลิงก์ไม่ทำให้ไฟล์เป็นสาธารณะ หากบัญชีเครื่องเรนเดอร์เข้าไม่ได้ให้ข้ามคิวและรายงาน ห้ามอ้างว่าไฟล์พร้อมเรนเดอร์เพียงเพราะอัปโหลดแล้ว':'')};
$('sourceMode').onchange();
})();

