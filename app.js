var $=function(i){return document.getElementById(i)},T=null,A=null,St={},B=null,step=0,ch={},msg="",tab="o",R=null;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
/* ===== VoteSafe engine: data is stored in the browser database (IndexedDB) ===== */
var ADM=false,VF=null,SESS={v:{},adm:false},FAIL={n:0,t:0};
function E(m){return new Error(m)}
function nm(x){return String(x||"").trim().replace(/\s+/g," ").toLowerCase()}
function l9(x){return String(x||"").replace(/\D/g,"").slice(-9)}
function fy(x){var m=String(x||"").match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);if(!m)return"";var y=Number(m[1]);return y>=1900&&y<=new Date().getFullYear()+1?String(y):""}
function yr(x){return fy(x)||String(x||"").trim().toLowerCase()}
function z(n){return("0"+n).slice(-2)}
function now(){var d=new Date();return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+" "+z(d.getHours())+":"+z(d.getMinutes())}
function lg(s,a,d){s.audit.unshift({ts:now(),action:a,detail:d||""});s.audit=s.audit.slice(0,200)}
/* one atomic read-modify-write on the database (this is what stops double voting) */
function tx(fn,w){return new Promise(function(res,rej){
 var o=indexedDB.open("votesafe",1);o.onupgradeneeded=function(){o.result.createObjectStore("kv")};o.onerror=function(){rej(E("Database unavailable"))};
 o.onsuccess=function(){var db=o.result,t=db.transaction("kv","readwrite"),s=t.objectStore("kv"),g=s.get("db"),out,err;
  g.onsuccess=function(){var st=g.result||{init:false};try{out=fn(st);if(w)s.put(st,"db")}catch(e){err=e;t.abort()}};
  t.oncomplete=function(){db.close();res(out)};t.onabort=function(){db.close();rej(err||E("Database error"))}}})}
function hashPw(pw,salt){
 if(window.crypto&&crypto.subtle){var en=new TextEncoder();return crypto.subtle.importKey("raw",en.encode(pw),"PBKDF2",false,["deriveBits"]).then(function(k){return crypto.subtle.deriveBits({name:"PBKDF2",salt:en.encode(salt),iterations:100000,hash:"SHA-256"},k,256)}).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return z(x.toString(16))}).join("")})}
 var h=2166136261,s=salt+pw+salt;for(var r=0;r<2000;r++)for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return Promise.resolve("f"+h.toString(16))}
function seedState(s,salt,hash){
 s.init=true;s.title="CECKOSA General Elections";s.status="draft";s.salt=salt;s.hash=hash;s.pos=[];s.cand=[];s.voters=[];s.votes=[];s.ballots=0;s.audit=[];s.n=100;
 var S={"President":["Amina Kato","Joseph Mwesigwa","Ruth Nankya"],"Vice President":["Samuel Opio","Grace Achieng"],"Deputy":["Patrick Byaruhanga","Martha Auma"],"Speaker":["Isaac Lubega","Esther Namatovu"],"Secretary":["Doreen Atim","Brian Mukasa"],"Treasurer":["Henry Ssebunya","Lydia Nakato"],"Publicity Secretary":["Kevin Tumusiime","Sarah Birungi"]},k=0;
 Object.keys(S).forEach(function(p){var id=++k;s.pos.push({id:id,name:p});S[p].forEach(function(c){s.cand.push({id:++s.n,position_id:id,name:c,bio:"Sample candidate - replace with real details."})})});
 [["Alice Namukasa","2023","0772000001"],["Bob Ochieng","2024","0772000002"],["Carol Nambi","2023","0772000003"],["David Mugisha","2025","0772000004"],["Esther Nakato","2022","0772000005"]].forEach(function(v){s.voters.push({id:++s.n,name:v[0],year:v[1],phone:v[2],has_voted:false,voted_at:null})});
 lg(s,"setup","Database created with sample data")}
function init(){return tx(function(s){return s},false).then(function(s){if(s.init)return;var salt=Math.random().toString(36).slice(2)+Date.now();return hashPw("Admin@123",salt).then(function(h){return tx(function(s2){if(!s2.init)seedState(s2,salt,h)},true)})})}
function tally(st){return st.pos.map(function(p){return{id:p.id,name:p.name,abstain:st.votes.filter(function(v){return v.p==p.id&&v.c==null}).length,candidates:st.cand.filter(function(c){return c.position_id==p.id}).map(function(c){return{id:c.id,name:c.name,votes:st.votes.filter(function(v){return v.c==c.id}).length}})}})}
function plist(st){return st.pos.map(function(p){return{id:p.id,name:p.name,candidates:st.cand.filter(function(c){return c.position_id==p.id})}})}
function voterOf(st,tok){if(!SESS.v[tok])throw E("Please log in again.");return st.voters.filter(function(x){return "v"+x.id==tok})[0]}
function locked(){if(FAIL.n>=8&&FAIL.t>Date.now())throw E("Too many attempts. Please wait 5 minutes.")}
function bad(){FAIL.n++;FAIL.t=Date.now()+300000;throw E("We could not match those details. Please check and try again.")}
function core(st,p,d,tok){
 var S=st.status;
 if(p=="status")return{title:st.title,status:S,logo:st.logo||""};
 if(p=="results"){if(S!="closed")throw E("Results are published when voting closes.");return{title:st.title,results:tally(st),registered:st.voters.length,voted:st.ballots}}
 if(p=="login"){locked();var v=l9(d.phone).length<7?null:st.voters.filter(function(x){return l9(x.phone)==l9(d.phone)})[0];
  if(!v||nm(d.name)!=nm(v.name)||yr(d.year)!=yr(v.year))bad();FAIL.n=0;SESS.v["v"+v.id]=true;return{token:"v"+v.id,name:v.name}}
 if(p=="ballot"){var v=voterOf(st,tok);return{status:S,title:st.title,name:v.name,has_voted:v.has_voted,voted_at:v.voted_at,positions:plist(st)}}
 if(p=="vote"){var v=voterOf(st,tok);if(S!="open")throw E("Voting is not open right now.");if(v.has_voted)throw E("You have already voted. A vote cannot be cast twice.");
  var rows=[];st.pos.forEach(function(x){var c=(d.choices||{})[x.id];if(c==null)throw E("Please make a choice (or abstain) for every position.");
   if(c=="abstain")rows.push({p:x.id,c:null});else{if(!st.cand.some(function(k){return k.id==c&&k.position_id==x.id}))throw E("Invalid choice.");rows.push({p:x.id,c:Number(c)})}});
  rows.forEach(function(r){st.votes.push(r)});v.has_voted=true;v.voted_at=now();st.ballots++;lg(st,"vote","A ballot was cast (voter identity is not stored with the choices)");delete SESS.v[tok];
  return{ok:true,receipt:"VS-"+Math.random().toString(16).slice(2,10).toUpperCase()}}
 if(p.indexOf("admin/")!=0)throw E("Not found.");
 if(tok!="adm"||!SESS.adm)throw E("Please log in again.");
 var nb=st.ballots;
 if(p=="admin/dashboard")return{title:st.title,status:S,registered:st.voters.length,voted:nb,results:tally(st),positions:plist(st),voters:st.voters.slice().sort(function(a,b){return a.name<b.name?-1:1}),audit:st.audit.slice(0,30)};
 if(p=="admin/backup")return{data:st};
 if(p=="admin/restore"){var b=d.data;if(!b||!b.init||!Array.isArray(b.voters)||!Array.isArray(b.pos))throw E("That file is not a valid VoteSafe backup.");Object.keys(st).forEach(function(k){delete st[k]});Object.assign(st,b);lg(st,"restore","Backup restored");return{ok:true}}
 if(p=="admin/status"){if(["draft","open","closed"].indexOf(d.status)<0)throw E("Invalid status.");if(d.status=="open"&&(!st.pos.length||!st.voters.length))throw E("Add at least one position and one voter before opening.");if(d.status=="draft"&&nb)throw E("Votes already exist, so this election cannot go back to draft.");st.status=d.status;lg(st,"status",d.status);return{ok:true}}
 if(p=="admin/title"){var t=String(d.title||"").trim();if(!t)throw E("Title cannot be empty.");st.title=t.slice(0,120);lg(st,"title",st.title);return{ok:true}}
 if(["admin/position","admin/candidate","admin/delete","admin/photo"].indexOf(p)>=0&&nb)throw E("Votes have been cast, so positions and candidates are locked.");
 if(p=="admin/photo"){var c=st.cand.filter(function(x){return x.id==d.id})[0];if(!c)throw E("Candidate not found.");c.photo=okI(d.photo,"jpeg");lg(st,"photo",c.name);return{ok:true}}
 if(p=="admin/logo"){st.logo=okI(d.logo,"png");lg(st,"logo",st.logo?"Logo set":"Logo removed");return{ok:true}}
 if(p=="admin/position"){var n=String(d.name||"").trim();if(!n)throw E("Enter a position name.");st.pos.push({id:++st.n,name:n.slice(0,80)});lg(st,"position+",n);return{ok:true}}
 if(p=="admin/candidate"){var n=String(d.name||"").trim();if(!n)throw E("Enter a candidate name.");st.cand.push({id:++st.n,position_id:d.position_id,name:n.slice(0,80),bio:String(d.bio||"").slice(0,300),photo:okI(d.photo,"jpeg")});lg(st,"candidate+",n);return{ok:true}}
 if(p=="admin/voter"){var n=String(d.name||"").trim(),y=fy(d.year),ph=String(d.phone||"").trim();
  if(!n||!y||l9(ph).length<7)throw E("Enter a valid name, 4-digit year of study (e.g. 2024) and phone number.");
  if(st.voters.some(function(x){return l9(x.phone)==l9(ph)}))throw E("That phone number is already registered.");st.voters.push({id:++st.n,name:n.slice(0,80),year:y,phone:ph,has_voted:false,voted_at:null});lg(st,"voter+",n);return{ok:true}}
 if(p=="admin/import"){var a=0,k=0;String(d.csv||"").split(/\r?\n/).forEach(function(r){if(!r.trim()||/^\s*name\s*,/i.test(r))return;var f=r.split(","),y=fy(f[1]);
   if(f.length<3||!f[0].trim()||!y||l9(f[2]).length<7||st.voters.some(function(x){return l9(x.phone)==l9(f[2])})){k++;return}
   st.voters.push({id:++st.n,name:f[0].trim().slice(0,80),year:y,phone:f[2].trim(),has_voted:false,voted_at:null});a++});lg(st,"import",a+" added, "+k+" skipped");return{added:a,skipped:k}}
 if(p=="admin/delete"){if(d.type=="candidate")st.cand=st.cand.filter(function(c){return c.id!=d.id});
  else if(d.type=="position"){st.cand=st.cand.filter(function(c){return c.position_id!=d.id});st.pos=st.pos.filter(function(x){return x.id!=d.id})}
  else if(d.type=="voter")st.voters=st.voters.filter(function(v){return !(v.id==d.id&&!v.has_voted)});else throw E("Invalid request.");lg(st,"delete",d.type+" "+d.id);return{ok:true}}
 if(p=="admin/wipe"){if(S=="open")throw E("Close voting before clearing data.");st.pos=[];st.cand=[];st.voters=[];st.votes=[];st.ballots=0;st.status="draft";lg(st,"wipe","All election data cleared");return{ok:true}}
 throw E("Not found.")}
function api(p,d,tok){d=d||{};
 if(p=="admin/login"){try{locked()}catch(e){return Promise.reject(e)}
  return tx(function(s){return s},false).then(function(s){return hashPw(d.password||"",s.salt).then(function(h){if(h!==s.hash){try{bad()}catch(e){throw e}}FAIL.n=0;SESS.adm=true;return{token:"adm"}})})}
 if(p=="admin/password"){if(!SESS.adm)return Promise.reject(E("Please log in again."));
  return tx(function(s){return s},false).then(function(s){return hashPw(d.old||"",s.salt).then(function(h){if(h!==s.hash)throw E("Current password is wrong.");if((d["new"]||"").length<8)throw E("New password must be at least 8 characters.");
   var salt=Math.random().toString(36).slice(2)+Date.now();return hashPw(d["new"],salt).then(function(h2){return tx(function(s2){s2.salt=salt;s2.hash=h2;lg(s2,"password","Admin password changed")},true)}).then(function(){return{ok:true}})})})}
 var w=["status","results","login","ballot","admin/dashboard","admin/backup"].indexOf(p)<0;
 return tx(function(st){return core(st,p,d,tok)},w)}
function M(){var m=msg;msg="";return m?'<div class="msg '+(m[0]=="!"?"err":"good")+'">'+esc(m.slice(1))+'</div>':""}
function boot(){api("status").then(function(s){St=s;$("ttl").textContent=s.title;var lo=$("logo");lo.onerror=function(){lo.hidden=true};lo.hidden=false;lo.src=s.logo||"logo.png";document.title=s.title;ADM?adminV():voterV()}).catch(function(e){$("app").innerHTML='<div class="card msg err">Cannot reach the server.</div>'})}
function badge(s){return '<span class="badge">'+{draft:"Not started",open:"Voting open",closed:"Voting closed"}[s]+'</span>'}
/* ---------- VOTER ---------- */
function voterV(){
 if(B)return ballotV();
 var h='<div class="card"><h2>Welcome</h2><p class="mut">'+esc(St.title)+' &nbsp;'+badge(St.status)+'</p>';
 if(St.status=="closed")h+='<button class="p w" onclick="resultsV()">View election results</button>';
 h+='</div><div class="card"><h3>Log in to vote</h3><p class="mut">Enter the same details you registered with.</p>'+M()+
 '<label class="f">Full name</label><input id="n" autocomplete="name" placeholder="e.g. Alice Namukasa"><label class="f">Year of study</label><input id="e" inputmode="numeric" maxlength="4" placeholder="e.g. 2024"><div class="mut" style="margin-top:4px">4-digit year, for example 2024</div><label class="f">Phone number</label><input id="p" type="tel" autocomplete="tel" placeholder="e.g. 0772 000 001"><button class="p w" id="lb" onclick="login()">Continue</button></div>';
 $("app").innerHTML=h;
}
function login(){$("lb").disabled=true;api("login",{name:$("n").value,year:$("e").value,phone:$("p").value}).then(function(r){T=r.token;return api("ballot",null,T)}).then(function(b){B=b;step=0;ch={};ballotV()}).catch(function(e){msg="!"+e.message;voterV()})}
function ballotV(){
 if(B.has_voted)return $("app").innerHTML='<div class="card"><div class="big">✅</div><h2 style="text-align:center">You have already voted</h2><p class="mut" style="text-align:center">Thank you, '+esc(B.name)+'. Your vote was recorded on '+esc(B.voted_at)+'. Each person can vote only once.</p><button class="w" onclick="out()">Log out</button></div>';
 if(B.status!="open")return $("app").innerHTML='<div class="card"><h2>Voting is '+(B.status=="draft"?"not open yet":"closed")+'</h2><p class="mut">'+(B.status=="draft"?"Please come back when the election starts.":"The election has ended.")+'</p><button class="w" onclick="out()">Log out</button></div>';
 var P=B.positions,n=P.length;
 if(step>=n)return reviewV();
 var p=P[step],h='<div class="card"><div class="mut">Hello, '+esc(B.name)+' · Step '+(step+1)+' of '+n+'</div><div class="bar"><i style="width:'+Math.round((step+1)*100/(n+1))+'%"></i></div><h2>'+esc(p.name)+'</h2><p class="mut">Tap one choice.</p>'+M();
 p.candidates.forEach(function(c){h+='<label class="opt '+(ch[p.id]==c.id?"sel":"")+'"><input type="radio" name="o" '+(ch[p.id]==c.id?"checked":"")+' onchange="ch['+p.id+']='+c.id+';ballotV()">'+ph(c)+'<span><b>'+esc(c.name)+'</b><small>'+esc(c.bio)+'</small></span></label>'});
 h+='<label class="opt '+(ch[p.id]=="abstain"?"sel":"")+'"><input type="radio" name="o" '+(ch[p.id]=="abstain"?"checked":"")+' onchange="ch['+p.id+']=\'abstain\';ballotV()"><span>Abstain<small>I do not want to choose anyone for this position</small></span></label>';
 h+='<div class="gap"><button onclick="'+(step?"step--;ballotV()":"out()")+'">'+(step?"← Back":"Cancel")+'</button><button class="p" onclick="nxt()">Next →</button></div></div>';
 $("app").innerHTML=h;
}
function nxt(){if(!ch[B.positions[step].id]){msg="!Please pick a candidate or Abstain to continue.";return ballotV()}step++;ballotV()}
function reviewV(){
 var h='<div class="card"><h2>Review your choices</h2><p class="mut">Check carefully. After you submit, you cannot change or vote again.</p>'+M()+'<table>';
 B.positions.forEach(function(p,i){var c=ch[p.id],nm=c=="abstain"?"Abstain":(p.candidates.filter(function(k){return k.id==c})[0]||{}).name;h+='<tr><td class="mut">'+esc(p.name)+'</td><td><b>'+esc(nm)+'</b></td><td><button class="s" onclick="step='+i+';ballotV()">Change</button></td></tr>'});
 $("app").innerHTML=h+'</table><button class="p w" onclick="ask()">Submit my vote</button></div>';
}
function ask(){var d=document.createElement("div");d.className="modal";d.id="md";d.innerHTML='<div class="card"><h2>Submit your vote?</h2><p>This is final. You will not be able to vote again.</p><div class="gap"><button onclick="$(\'md\').remove()">Go back</button><button class="p" onclick="send()">Yes, submit</button></div></div>';document.body.appendChild(d)}
function send(){$("md").remove();api("vote",{choices:ch},T).then(function(r){$("app").innerHTML='<div class="card"><div class="big">🎉</div><h2 style="text-align:center">Vote submitted</h2><p class="mut" style="text-align:center">Thank you for taking part. Keep this receipt number.</p><div class="code">'+r.receipt+'</div><button class="w" onclick="out()">Finish</button></div>';T=null;B=null}).catch(function(e){msg="!"+e.message;reviewV()})}
function out(){T=null;B=null;ch={};step=0;boot()}
function resultsV(){api("results").then(function(r){var pc=r.registered?Math.round(r.voted*100/r.registered):0;$("app").innerHTML='<div class="card"><h2>Official results</h2><p class="mut">'+esc(r.title)+'</p><div class="res"><span>Turnout: '+r.voted+' of '+r.registered+' voters</span><b>'+pc+'%</b></div><div class="bar" style="margin:4px 0 0"><i style="width:'+pc+'%"></i></div></div>'+resCards(r.results)+'<button class="w" onclick="boot()">Back</button>'}).catch(function(e){msg="!"+e.message;voterV()})}
function resCards(rs){return rs.map(function(p){var t=p.candidates.reduce(function(a,c){return a+c.votes},0),mx=Math.max.apply(null,p.candidates.map(function(c){return c.votes}).concat([0])),w=p.candidates.filter(function(c){return c.votes==mx}).length;
 return '<div class="card"><h3>'+esc(p.name)+'</h3>'+p.candidates.map(function(c){var pc=t?Math.round(c.votes*100/t):0;return '<div class="res"><span>'+esc(c.name)+(c.votes==mx&&mx>0?(w>1?" 🤝":" 🏆"):"")+'</span><b>'+c.votes+' ('+pc+'%)</b></div><div class="bar" style="margin:4px 0 8px"><i style="width:'+pc+'%"></i></div>'}).join("")+'<div class="mut">Abstained: '+p.abstain+(w>1&&mx>0?" · Tie for first place":"")+'</div></div>'}).join("")}
/* ---------- ADMIN ---------- */
function adminV(){
 if(!A)return $("app").innerHTML='<div class="card"><h2>Administrator login</h2>'+M()+'<label class="f">Password</label><input id="ap" type="password"><button class="p w" onclick="alogin()">Log in</button><p class="mut"></p></div>';
 api("admin/dashboard",null,A).then(function(d){R=d;adminR()}).catch(function(e){A=null;msg="!"+e.message;adminV()});
}
function alogin(){api("admin/login",{password:$("ap").value}).then(function(r){A=r.token;adminV()}).catch(function(e){msg="!"+e.message;adminV()})}
function act(p,d,ok,after){api(p,d,A).then(function(r){msg="+"+(typeof ok=="function"?ok(r):ok);VF=null;adminV()}).catch(function(e){msg="!"+e.message;adminR()})}
function adminR(){
 var h='<div class="tabs">'+[["o","Overview"],["c","Candidates"],["v","Voters"],["s","Settings"]].map(function(t){return '<button class="'+(tab==t[0]?"on":"")+'" onclick="tab=\''+t[0]+'\';adminR()">'+t[1]+'</button>'}).join("")+'</div>'+M();
 if(tab=="o"){var pc=R.registered?Math.round(R.voted*100/R.registered):0;
  h+='<div class="card"><div class="row"><h2>'+esc(R.title)+'</h2>'+badge(R.status)+'</div><div class="stats"><div><b>'+R.registered+'</b>Registered</div><div><b>'+R.voted+'</b>Voted</div><div><b>'+pc+'%</b>Turnout</div></div><div class="bar" style="margin-top:12px"><i style="width:'+pc+'%"></i></div>'+
  (R.status=="draft"?'<button class="p w" onclick="cf(\'Open voting now? Voters will be able to log in and vote.\',function(){act(\'admin/status\',{status:\'open\'},\'Voting is now open.\')})">▶ Open voting</button>':"")+
  (R.status=="open"?'<button class="w" onclick="cf(\'Close voting? No more votes will be accepted.\',function(){act(\'admin/status\',{status:\'closed\'},\'Voting closed. Results are now public.\')})">■ Close voting &amp; publish results</button>':"")+
  (R.status=="closed"?'<button class="w" onclick="exp()">⬇ Download results (CSV)</button>':"")+'</div><h3>Live results (admin only until closed)</h3>'+resCards(R.results);
 }
 if(tab=="c"){h+='<div class="card"><h3>Candidate list</h3><p class="mut">Download the registered candidates as a Word document to share before voting.</p><button class="w" onclick="wc()">⬇ Download candidate list (Word)</button></div>';R.positions.forEach(function(p){h+='<div class="card"><div class="row"><h3>'+esc(p.name)+'</h3><button class="s d" onclick="del(\'position\','+p.id+')">Remove</button></div>'+p.candidates.map(function(c){return '<div class="row" style="margin:6px 0"><span style="display:flex;gap:10px;align-items:center;min-width:0">'+ph(c)+esc(c.name)+'</span><span style="display:flex;gap:6px;flex:none"><label class="s fb">Photo<input type="file" hidden accept="image/*" onchange="setPh('+c.id+',this.files[0])"></label><button class="s d" onclick="del(\'candidate\','+c.id+')">✕</button></span></div>'}).join("")+
  '<input id="cn'+p.id+'" placeholder="New candidate name" style="margin-top:8px"><label class="f">Photo (optional)</label><input id="cf'+p.id+'" type="file" accept="image/*"><button class="s w" onclick="addC('+p.id+')">Add candidate</button></div>'});
  h+='<div class="card"><h3>Add a position</h3><div class="gap"><input id="np" placeholder="e.g. Organising Secretary"><button class="s" onclick="act(\'admin/position\',{name:$(\'np\').value},\'Position added.\')">Add</button></div></div>';}
 if(tab=="v"){h+='<div class="card"><h3>Register a voter</h3><label class="f">Full name</label><input id="vn" value="'+esc((VF||{}).n)+'"><label class="f">Year of study</label><input id="ve" inputmode="numeric" maxlength="4" placeholder="e.g. 2024" value="'+esc((VF||{}).e)+'"><label class="f">Phone</label><input id="vp" type="tel" value="'+esc((VF||{}).p)+'"><button class="p w" onclick="VF={n:$(\'vn\').value,e:$(\'ve\').value,p:$(\'vp\').value};act(\'admin/voter\',{name:$(\'vn\').value,year:$(\'ve\').value,phone:$(\'vp\').value},\'Voter registered.\')">Add voter</button></div>'+
  '<div class="card"><h3>Import many voters</h3><p class="mut">One per line: name,year,phone</p><textarea id="cv" rows="4" placeholder="Jane Doe,2024,0772123456"></textarea><button class="w" onclick="act(\'admin/import\',{csv:$(\'cv\').value},function(r){return r.added+\' added, \'+r.skipped+\' skipped.\'})">Import</button></div>'+
  '<div class="card"><h3>Voter list ('+R.registered+')</h3><p class="mut">Download for sharing before voting, so voters can check their details.</p><div class="gap" style="margin-bottom:10px"><button class="s" onclick="wv(0)">⬇ Word (hidden phone digits)</button><button class="s" onclick="wv(1)">⬇ Word (full phones)</button></div><div class="sc"><table><tr><th>Name</th><th>Year</th><th>Status</th><th></th></tr>'+R.voters.map(function(v){return '<tr><td>'+esc(v.name)+'<br><span class="mut">'+esc(v.phone)+'</span></td><td>'+esc(v.year)+'</td><td>'+(v.has_voted?"✅ Voted":"Not yet")+'</td><td>'+(v.has_voted?"":'<button class="s d" onclick="del(\'voter\','+v.id+')">✕</button>')+'</td></tr>'}).join("")+'</table></div></div>';}
 if(tab=="s"){h+='<div class="card"><h3>Organisation logo</h3><p class="mut">Shown in the top bar. It is resized automatically.</p>'+(St.logo?'<img src="'+esc(St.logo)+'" alt="" style="height:48px;margin:6px 0;display:block">':"")+'<input type="file" accept="image/*" onchange="setLogo(this.files[0])">'+(St.logo?'<button class="w d" onclick="setLogo(null)">Remove logo</button>':"")+'</div><div class="card"><h3>Election title</h3><input id="tt" value="'+esc(R.title)+'"><button class="w" onclick="act(\'admin/title\',{title:$(\'tt\').value},\'Title saved.\')">Save title</button></div>'+
  '<div class="card"><h3>Change password</h3><label class="f">Current password</label><input id="po" type="password"><label class="f">New password (8+ characters)</label><input id="pn" type="password"><button class="w" onclick="act(\'admin/password\',{old:$(\'po\').value,new:$(\'pn\').value},\'Password changed.\')">Change password</button></div>'+
  '<div class="card"><h3>Activity log</h3><div class="sc"><table>'+R.audit.map(function(a){return '<tr><td class="mut">'+esc(a.ts)+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.detail)}).join("</td></tr>")+'</td></tr></table></div></div>'+
  '<div class="card"><h3>Database backup</h3><p class="mut">All election data is stored in this browser. Download a backup before opening, after closing, and regularly in between.</p><button class="w" onclick="backup()">⬇ Download backup (JSON)</button><label class="f">Restore from a backup file</label><input type="file" id="rf" accept=".json" onchange="restore(this.files[0])"></div>'+
  '<div class="card"><h3>Start fresh</h3><p class="mut">Deletes all positions, candidates, voters and votes (including sample data).</p><button class="w d" onclick="cf(\'Delete ALL election data? This cannot be undone.\',function(){act(\'admin/wipe\',{},\'All data cleared.\')})">Clear all data</button></div>';}
 $("app").innerHTML=h+'<button class="w" onclick="A=null;ADM=false;boot()">Log out</button>';
}
function cf(m,f){var d=document.createElement("div");d.className="modal";d.innerHTML='<div class="card"><h2>Please confirm</h2><p></p><div class="gap"><button id="cn">Cancel</button><button class="p" id="cy">Yes, continue</button></div></div>';d.querySelector("p").textContent=m;document.body.appendChild(d);document.getElementById("cn").onclick=function(){d.remove()};document.getElementById("cy").onclick=function(){d.remove();f()}}
function del(t,i){cf("Remove this "+t+"?",function(){act("admin/delete",{type:t,id:i},"Removed.")})}
function dl(name,type,text){var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:type}));a.download=name;a.click()}
function exp(){api("admin/dashboard",null,A).then(function(r){var o="Position,Candidate,Votes\n";r.results.forEach(function(p){p.candidates.forEach(function(c){o+='"'+p.name+'","'+c.name+'",'+c.votes+"\n"});o+='"'+p.name+'","(Abstained)",'+p.abstain+"\n"});dl("election-results.csv","text/csv",o)})}
function backup(){api("admin/backup",null,A).then(function(r){dl("votesafe-backup-"+now().replace(/[: ]/g,"-")+".json","application/json",JSON.stringify(r.data))})}
function restore(f){if(!f)return;var r=new FileReader();r.onload=function(){try{var o=JSON.parse(r.result)}catch(e){msg="!That file is not a valid backup.";return adminR()}cf("Replace ALL current data with this backup?",function(){act("admin/restore",{data:o},"Backup restored.")})};r.readAsText(f)}
/* ---------- images, photos, logo ---------- */
function okI(x,t){x=String(x||"");if(x&&(!new RegExp("^data:image/"+t+";base64,[A-Za-z0-9+/=]+$").test(x)||x.length>250000))throw E("Invalid image.");return x}
function img(f,cb,mx,t){var r=new FileReader();r.onload=function(){var i=new Image();i.onload=function(){var s=Math.min(1,mx/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(i.width*s));c.height=Math.max(1,Math.round(i.height*s));var x=c.getContext("2d");if(t=="image/jpeg"){x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height)}x.drawImage(i,0,0,c.width,c.height);cb(c.toDataURL(t,.85))};i.onerror=function(){cb(null)};i.src=r.result};r.onerror=function(){cb(null)};r.readAsDataURL(f)}
function ph(c){return c.photo?'<img class="ph" alt="" src="'+esc(c.photo)+'">':'<span class="ph av">'+esc(c.name.trim().split(/\s+/).slice(0,2).map(function(w){return w[0]}).join("").toUpperCase())+'</span>'}
function addC(p){var f=$("cf"+p).files[0],go=function(u){act("admin/candidate",{position_id:p,name:$("cn"+p).value,photo:u},"Candidate added.")};f?img(f,function(u){u?go(u):(msg="!That image could not be read.",adminR())},320,"image/jpeg"):go("")}
function setPh(id,f){if(f)img(f,function(u){u?act("admin/photo",{id:id,photo:u},"Photo updated."):(msg="!That image could not be read.",adminR())},320,"image/jpeg")}
function setLogo(f){var go=function(u){api("admin/logo",{logo:u},A).then(function(){msg="+Logo updated.";boot()}).catch(function(e){msg="!"+e.message;adminR()})};if(!f)return go("");img(f,function(u){u?go(u):(msg="!That image could not be read.",adminR())},240,"image/png")}
/* ---------- Word (.docx) export, built in the browser with no libraries ---------- */
var CT=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CT[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zip(fs){var en=new TextEncoder(),ps=[],cs=[],off=0,cl=0;
 fs.forEach(function(f){var nb=en.encode(f.n),c=crc(f.d),h=new DataView(new ArrayBuffer(30)),g=new DataView(new ArrayBuffer(46));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);h.setUint32(14,c,true);h.setUint32(18,f.d.length,true);h.setUint32(22,f.d.length,true);h.setUint16(26,nb.length,true);
  g.setUint32(0,0x02014b50,true);g.setUint16(4,20,true);g.setUint16(6,20,true);g.setUint16(8,0x0800,true);g.setUint16(14,0x21,true);g.setUint32(16,c,true);g.setUint32(20,f.d.length,true);g.setUint32(24,f.d.length,true);g.setUint16(28,nb.length,true);g.setUint32(42,off,true);
  ps.push(new Uint8Array(h.buffer),nb,f.d);cs.push(new Uint8Array(g.buffer),nb);off+=30+nb.length+f.d.length;cl+=46+nb.length});
 var e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,fs.length,true);e.setUint16(10,fs.length,true);e.setUint32(12,cl,true);e.setUint32(16,off,true);
 return new Blob(ps.concat(cs,[new Uint8Array(e.buffer)]))}
function wp(t,sz,b,al){return'<w:p><w:pPr><w:spacing w:after="80"/><w:jc w:val="'+(al||"left")+'"/></w:pPr><w:r><w:rPr>'+(b?"<w:b/>":"")+'<w:sz w:val="'+sz+'"/></w:rPr><w:t xml:space="preserve">'+esc(t)+'</w:t></w:r></w:p>'}
function wdoc(fn,t,sub,H,W,rows,note){var en=new TextEncoder(),X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
 bd=["top","left","bottom","right","insideH","insideV"].map(function(s){return'<w:'+s+' w:val="single" w:sz="4" w:color="999999"/>'}).join(""),
 tr=function(c,hd){return'<w:tr>'+(hd?'<w:trPr><w:tblHeader/></w:trPr>':'')+c.map(function(x,i){return'<w:tc><w:tcPr><w:tcW w:w="'+W[i]+'" w:type="dxa"/>'+(hd?'<w:shd w:val="clear" w:color="auto" w:fill="DCE6F5"/>':'')+'</w:tcPr>'+wp(x,20,hd)+'</w:tc>'}).join("")+'</w:tr>'},
 body=wp(t,32,1,"center")+wp(sub,26,1,"center")+wp("Generated "+now()+" · "+rows.length+" entries",18,0,"center")+wp(note,20,0)+'<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>'+bd+'</w:tblBorders></w:tblPr><w:tblGrid>'+W.map(function(w){return'<w:gridCol w:w="'+w+'"/>'}).join("")+'</w:tblGrid>'+tr(H,1)+rows.map(function(r){return tr(r,0)}).join("")+'</w:tbl>'+wp("",20)+wp("Powered by BLW Tech Solutions",16,0,"center"),
 doc=X+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1200" w:bottom="1000" w:left="1200"/></w:sectPr></w:body></w:document>';
 dl(fn,"application/vnd.openxmlformats-officedocument.wordprocessingml.document",zip([
  {n:"[Content_Types].xml",d:en.encode(X+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},
  {n:"_rels/.rels",d:en.encode(X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},
  {n:"word/document.xml",d:en.encode(doc)}]))}
function mask(p){p=String(p);return p.length<8?p:p.slice(0,4)+p.slice(4,-3).replace(/\d/g,"*")+p.slice(-3)}
function wv(full){api("admin/dashboard",null,A).then(function(r){wdoc("registered-voters.docx",r.title,"List of Registered Voters",["No.","Full name","Year of study","Phone"],[800,4200,1700,2400],r.voters.map(function(v,i){return[String(i+1),v.name,v.year,full?v.phone:mask(v.phone)]}),"Please check that your name, year of study and phone number are correct. You must enter these details exactly as shown to log in and vote. If anything is wrong, contact the election administrator before voting opens.")})}
function wc(){api("admin/dashboard",null,A).then(function(r){var rows=[];r.positions.forEach(function(p){p.candidates.forEach(function(c){rows.push([String(rows.length+1),p.name,c.name])})});wdoc("registered-candidates.docx",r.title,"List of Registered Candidates",["No.","Position","Candidate"],[800,3600,4900],rows,"These are the candidates registered for each position. Please report any error in a name or position to the election administrator before voting opens.")})}
init().then(boot).catch(function(){document.getElementById("app").innerHTML='<div class="card msg err">This browser cannot store data here. Please use a normal (not private) window in Chrome, Edge, Firefox or Safari.</div>'});
