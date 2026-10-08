
const { io } = require('socket.io-client');
const BASE='http://localhost:5000';
async function login(user,pwd){
  const r=await fetch(BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:pwd})});
  const cookie=r.headers.get('set-cookie');
  return cookie.split(';')[0];
}
async function main(){
  const ckT=await login('teacher','teacher123');
  const ckS=await login('student','student123');
  const mk=(ck)=>io(BASE,{transports:['polling','websocket'],extraHeaders:{Cookie:ck},reconnection:false});
  const sT=mk(ckT), sS=mk(ckS);
  const ok=await new Promise((resolve)=>{
    let joined=0;
    const check=()=>{ if(++joined===2){
      sT.emit('whiteboard_sync',{course_id:4,elements:[{id:'t1',type:'rectangle',x:10,y:10,width:100,height:50}]});
      setTimeout(()=>resolve(false),6000);
    }};
    sT.on('joined_course',check); sS.on('joined_course',check);
    sS.on('whiteboard_updated',(d)=>{
      console.log('STUDENT GOT:',JSON.stringify(d).slice(0,200));
      resolve(d.elements&&d.elements.length===1&&d.elements[0].id==='t1');
    });
    sT.on('whiteboard_updated',()=>{console.log('TEACHER GOT ECHO (unexpected include_self)');});
    sT.on('connect',()=>sT.emit('join_course',{course_id:4}));
    sS.on('connect',()=>sS.emit('join_course',{course_id:4}));
    sT.on('connect_error',e=>console.log('T conn err',e.message));
    sS.on('connect_error',e=>console.log('S conn err',e.message));
    sT.on('error',e=>console.log('T err',JSON.stringify(e)));
    sS.on('error',e=>console.log('S err',JSON.stringify(e)));
  });
  console.log('SYNC_RESULT:',ok?'PASS':'FAIL');
  sT.close(); sS.close(); process.exit(ok?0:1);
}
main().catch(e=>{console.log('ERR',e.message);process.exit(1)});
