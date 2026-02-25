import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080b10;--s1:#0d1117;--s2:#111620;--s3:#171e2b;
  --border:#1e2a3a;--border2:#2a3a52;
  --lime:#aaff5e;--lime-dim:rgba(170,255,94,0.12);
  --blue:#4db8ff;--blue-dim:rgba(77,184,255,0.12);
  --orange:#ff8c42;--red:#ff5252;--red-dim:rgba(255,82,82,0.12);
  --purple:#c084fc;
  --text:#d4e0f0;--text2:#6b849f;--text3:#324158;
  --mono:'IBM Plex Mono',monospace;--sans:'DM Sans',system-ui,sans-serif;
  --r:5px;
}
html,body,#root{height:100%;background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
button{cursor:pointer;font-family:var(--sans)}
textarea,input,select{font-family:var(--mono)}
.jk{color:#7ec8e3}.js{color:#86efac}.jn{color:#fde68a}.jb{color:#d8b4fe}.jx{color:#6b7280}
@keyframes slideIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
`;

// ── SAMPLE ────────────────────────────────────────────────────────────────────
const SAMPLE = {
  user:{id:7,firstName:"Sana",lastName:"Ullah",email:"sana@dev.io",active:true,
    address:{city:"Karachi",country:"PK"}},
  orders:[
    {id:1001,product:"Notebook",price:12.99,shipped:true},
    {id:1002,product:"Pen Set",price:8.49,shipped:false},
    {id:1003,product:"Ink",price:4.99,shipped:true},
  ],
  tags:["developer","designer","writer"],
  meta:{version:3,createdAt:"2024-01-15"},
};

// ── TOKEN EXTRACTION ──────────────────────────────────────────────────────────
function extractTokens(obj, prefix="", depth=0){
  if(depth>25) return [];
  const tokens=[];
  if(Array.isArray(obj)){
    if(!obj.length) return [];
    const first=obj[0];
    if(first!==null && typeof first==="object" && !Array.isArray(first)){
      const keys=new Set();
      obj.forEach(item=>{ if(item && typeof item==="object") Object.keys(item).forEach(k=>keys.add(k)); });
      keys.forEach(key=>{
        const path=`${prefix}[].${key}`;
        const sample=obj.map(i=>i?.[key]).find(v=>v!==undefined);
        if(sample!==null && typeof sample==="object") tokens.push(...extractTokens(sample,path,depth+1));
        else tokens.push({path,type:sample===null?"null":typeof sample,isArray:true});
      });
    } else {
      tokens.push({path:`${prefix}[]`,type:typeof obj[0],isArray:true});
    }
  } else if(obj!==null && typeof obj==="object"){
    for(const [k,v] of Object.entries(obj)){
      const p=prefix?`${prefix}.${k}`:k;
      if(v!==null && typeof v==="object") tokens.push(...extractTokens(v,p,depth+1));
      else tokens.push({path:p,type:v===null?"null":typeof v,isArray:false});
    }
  }
  return tokens;
}

// ── RESOLVE TOKEN ─────────────────────────────────────────────────────────────
function resolveToken(json,path){
  const segs=[];
  const re=/([^.[\]]+)|\[\]/g; let m;
  while((m=re.exec(path))!==null) segs.push(m[0]);
  const matches=[];
  function walk(val,idx,cpath){
    if(idx>=segs.length){matches.push({path:cpath||path,value:val});return;}
    const s=segs[idx];
    if(s==="[]"){
      if(!Array.isArray(val)) return;
      val.forEach((item,i)=>walk(item,idx+1,`${cpath}[${i}]`));
    } else {
      if(val===null||typeof val!=="object"||Array.isArray(val)) return;
      const child=val[s];
      if(child===undefined) return;
      walk(child,idx+1,cpath?`${cpath}.${s}`:s);
    }
  }
  walk(json,0,"");
  return {values:matches.map(m=>m.value),sampleMatches:matches.slice(0,5),matchCount:matches.length};
}

// ── HIGHLIGHT JSON ────────────────────────────────────────────────────────────
function hlJSON(val,ind=0){
  const p="  ".repeat(ind),ip="  ".repeat(ind+1);
  if(val===null) return `<span class="jx">null</span>`;
  if(typeof val==="boolean") return `<span class="jb">${val}</span>`;
  if(typeof val==="number") return `<span class="jn">${val}</span>`;
  if(typeof val==="string") return `<span class="js">"${val.replace(/</g,"&lt;").replace(/>/g,"&gt;")}"</span>`;
  if(Array.isArray(val)){
    if(!val.length) return "[]";
    if(val.length<=4 && val.every(v=>v===null||typeof v!=="object"))
      return `[${val.map(v=>hlJSON(v,0)).join(", ")}]`;
    const items=val.map(v=>`${ip}${hlJSON(v,ind+1)}`).join(",\n");
    return `[\n${items}\n${p}]`;
  }
  const entries=Object.entries(val);
  if(!entries.length) return "{}";
  const lines=entries.map(([k,v])=>`${ip}<span class="jk">"${k}"</span>: ${hlJSON(v,ind+1)}`).join(",\n");
  return `{\n${lines}\n${p}}`;
}

// ── GENERATE OUTPUT ───────────────────────────────────────────────────────────
function generateOutput(json,sequence,mode){
  if(!json||!sequence.length) return {result:null,html:"",warnings:[]};
  const warnings=[];

  if(mode==="text"){
    const parts=sequence.map(item=>{
      const {values}=resolveToken(json,item.path);
      if(!values.length){warnings.push(item.id);return "";}
      return values.length===1?String(values[0]):values.join(item.joiner??", ");
    });
    let result="";
    parts.forEach((p,i)=>{
      result+=p;
      if(i<parts.length-1) result+=sequence[i].sep??" ";
    });
    return {result,html:`<span class="js">"${result.replace(/</g,"&lt;")}"</span>`,warnings};
  }

  if(mode==="array"){
    const arr=sequence.map(item=>{
      const {values}=resolveToken(json,item.path);
      if(!values.length){warnings.push(item.id);return null;}
      return values.length===1?values[0]:values;
    });
    return {result:arr,html:hlJSON(arr),warnings};
  }

  if(mode==="object"){
    const obj={};
    for(const item of sequence){
      const key=item.label||item.path;
      const {values}=resolveToken(json,item.path);
      if(!values.length){warnings.push(item.id);obj[key]=null;continue;}
      obj[key]=values.length===1?values[0]:values;
    }
    return {result:obj,html:hlJSON(obj),warnings};
  }

  return {result:null,html:"",warnings:[]};
}

// ── DRAG STATE (module-level to survive re-renders) ───────────────────────────
let _drag=null;

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [jsonText,setJsonText]=useState("");
  const [parsedJSON,setParsedJSON]=useState(null);
  const [parseError,setParseError]=useState("");
  const [tokens,setTokens]=useState([]);
  const [search,setSearch]=useState("");
  const [selectedToken,setSelectedToken]=useState(null);
  const [sequence,setSequence]=useState([]);
  const [mode,setMode]=useState("text");
  const [outputHTML,setOutputHTML]=useState("");
  const [rawResult,setRawResult]=useState(null);
  const [warnings,setWarnings]=useState([]);
  const [copyMsg,setCopyMsg]=useState("");
  const [dropHL,setDropHL]=useState(false);
  const [dragOverIdx,setDragOverIdx]=useState(null);
  const [draggingIdx,setDraggingIdx]=useState(null);
  const fileRef=useRef();

  // Persist
  useEffect(()=>{
    try{
      const d=JSON.parse(localStorage.getItem("jtc-v4")||"{}");
      if(d.sequence) setSequence(d.sequence);
      if(d.mode) setMode(d.mode);
      if(d.jsonText){setJsonText(d.jsonText);_parseJSON(d.jsonText);}
    }catch{}
  },[]);

  useEffect(()=>{
    try{localStorage.setItem("jtc-v4",JSON.stringify({sequence,mode,jsonText}));}catch{}
  },[sequence,mode,jsonText]);

  // Recompute output live
  useEffect(()=>{
    if(!parsedJSON||!sequence.length){
      setOutputHTML("");setRawResult(null);setWarnings([]);return;
    }
    const {result,html,warnings:w}=generateOutput(parsedJSON,sequence,mode);
    setOutputHTML(html);setRawResult(result);setWarnings(w);
  },[parsedJSON,sequence,mode]);

  function _parseJSON(text){
    if(!text.trim()){setParsedJSON(null);setTokens([]);setParseError("");return;}
    try{
      const p=JSON.parse(text);
      setParsedJSON(p);setParseError("");setTokens(extractTokens(p));
    }catch(e){setParsedJSON(null);setTokens([]);setParseError(e.message);}
  }

  function handleTextChange(t){setJsonText(t);_parseJSON(t);}

  function loadSample(){
    const t=JSON.stringify(SAMPLE,null,2);
    setJsonText(t);_parseJSON(t);
  }

  function handleFile(e){
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{handleTextChange(ev.target.result);};
    r.readAsText(f); e.target.value="";
  }

  function uid(path){return `${path}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;}

  function addToSequence(path){
    setSequence(prev=>[...prev,{id:uid(path),path,sep:" ",joiner:", ",label:path}]);
  }

  function removeItem(id){setSequence(prev=>prev.filter(i=>i.id!==id));}
  function updateItem(id,patch){setSequence(prev=>prev.map(i=>i.id===id?{...i,...patch}:i));}
  function clearSequence(){setSequence([]);}

  function moveItem(from,to){
    if(to<0||to>=sequence.length) return;
    setSequence(prev=>{
      const a=[...prev];
      const [x]=a.splice(from,1);
      a.splice(to,0,x);
      return a;
    });
  }

  // ── Drag from library ──
  function onTokenDragStart(e,path){
    _drag={type:"lib",path};
    e.dataTransfer.effectAllowed="copy";
    e.dataTransfer.setData("text/plain",path);
  }

  // ── Drop zone ──
  function onZoneDragOver(e){
    e.preventDefault();
    if(_drag) setDropHL(true);
  }
  function onZoneDragLeave(e){
    // Only clear if leaving the zone itself, not a child
    if(!e.currentTarget.contains(e.relatedTarget)) setDropHL(false);
  }
  function onZoneDrop(e){
    e.preventDefault();setDropHL(false);
    if(_drag?.type==="lib") addToSequence(_drag.path);
    _drag=null;
  }

  // ── Reorder drag ──
  function onItemDragStart(e,idx){
    _drag={type:"seq",idx};
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",String(idx));
    e.stopPropagation();
  }
  function onItemDragOver(e,idx){
    e.preventDefault();e.stopPropagation();
    if(_drag?.type==="seq") setDragOverIdx(idx);
    else if(_drag?.type==="lib") setDropHL(false); // inside zone already
  }
  function onItemDrop(e,idx){
    e.preventDefault();e.stopPropagation();
    if(_drag?.type==="seq" && _drag.idx!==idx) moveItem(_drag.idx,idx);
    else if(_drag?.type==="lib") addToSequence(_drag.path);
    setDragOverIdx(null);setDraggingIdx(null);_drag=null;
  }
  function onItemDragEnd(){setDragOverIdx(null);setDraggingIdx(null);}

  function copyResult(){
    if(rawResult===null) return;
    const t=typeof rawResult==="string"?rawResult:JSON.stringify(rawResult,null,2);
    navigator.clipboard.writeText(t);
    setCopyMsg("Copied!"); setTimeout(()=>setCopyMsg(""),1500);
  }

  function downloadResult(){
    if(rawResult===null) return;
    const isText=mode==="text";
    const t=isText?rawResult:JSON.stringify(rawResult,null,2);
    const blob=new Blob([t],{type:isText?"text/plain":"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`output.${isText?"txt":"json"}`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  const tokenDetails=useMemo(()=>{
    if(!selectedToken||!parsedJSON) return null;
    return resolveToken(parsedJSON,selectedToken.path);
  },[selectedToken,parsedJSON]);

  const filteredTokens=useMemo(()=>{
    if(!search.trim()) return tokens;
    return tokens.filter(t=>t.path.toLowerCase().includes(search.toLowerCase()));
  },[tokens,search]);

  const groups=useMemo(()=>{
    const g={};
    filteredTokens.forEach(t=>{
      const top=t.path.split(".")[0].replace(/\[\].*$/,"").replace(/\[.*$/,"")||"root";
      if(!g[top]) g[top]=[];
      g[top].push(t);
    });
    return g;
  },[filteredTokens]);

  function typeColor(type){
    return {string:"#86efac",number:"#fde68a",boolean:"#d8b4fe",null:"#6b7280"}[type]||"#4db8ff";
  }

  const SEP=[
    {label:"Space",value:" "},{label:"Comma",value:", "},
    {label:"Newline",value:"\n"},{label:"Pipe",value:" | "},{label:"None",value:""},
  ];

  const modeColor=mode==="text"?"var(--lime)":mode==="array"?"var(--blue)":"var(--orange)";
  const modeDim=mode==="text"?"var(--lime-dim)":mode==="array"?"var(--blue-dim)":"rgba(255,140,66,0.12)";

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>

        {/* HEADER */}
        <div style={{
          display:"flex",alignItems:"center",gap:12,
          padding:"0 16px",height:46,
          borderBottom:"1px solid var(--border)",background:"var(--s1)",flexShrink:0
        }}>
          <span style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--lime)",fontWeight:700}}>{"{ }"}</span>
          <span style={{fontWeight:700,fontSize:15,letterSpacing:-0.3}}>
            JSON <span style={{color:"var(--lime)"}}>Token</span> Converter
          </span>
          <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
            {tokens.length>0 && <Chip>{tokens.length} tokens</Chip>}
            {sequence.length>0 && <Chip color="var(--lime)">{sequence.length} in sequence</Chip>}
            {/* Mode switcher */}
            <div style={{display:"flex",gap:2,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--r)",padding:2}}>
              {["text","array","object"].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{
                  padding:"3px 9px",fontSize:10,fontWeight:700,letterSpacing:0.5,
                  textTransform:"uppercase",borderRadius:3,border:"none",
                  background:mode===m?modeColor:"transparent",
                  color:mode===m?"#000":"var(--text2)",transition:"all 0.15s"
                }}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 3 COLUMNS */}
        <div style={{display:"grid",gridTemplateColumns:"300px 260px 1fr",flex:1,overflow:"hidden"}}>

          {/* COL 1: JSON INPUT */}
          <div style={{borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <PanelHead title="JSON Input">
              <Btn small accent onClick={loadSample}>Load Sample</Btn>
            </PanelHead>
            <div style={{flex:1,overflow:"auto",padding:10,background:"var(--s2)"}}>
              <textarea
                value={jsonText}
                onChange={e=>handleTextChange(e.target.value)}
                placeholder={'{\n  "key": "value"\n}'}
                spellCheck={false}
                style={{
                  width:"100%",minHeight:220,background:"var(--bg)",
                  border:`1px solid ${parseError?"var(--red)":"var(--border)"}`,
                  color:"var(--text)",fontSize:11,lineHeight:1.6,
                  padding:10,borderRadius:"var(--r)",resize:"vertical",outline:"none",
                  transition:"border-color 0.15s"
                }}
              />
              {parseError && (
                <div style={{
                  marginTop:7,padding:"7px 10px",background:"var(--red-dim)",
                  border:"1px solid var(--red)",borderRadius:"var(--r)",
                  fontSize:11,color:"var(--red)",lineHeight:1.5
                }}>⚠ {parseError}</div>
              )}
              {parsedJSON && !parseError && (
                <div style={{
                  marginTop:7,padding:"5px 10px",
                  background:"rgba(170,255,94,0.08)",border:"1px solid rgba(170,255,94,0.3)",
                  borderRadius:"var(--r)",fontSize:11,color:"var(--lime)"
                }}>✓ Valid — {tokens.length} tokens extracted</div>
              )}
              <div style={{marginTop:10}}>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{display:"none"}}/>
                <Btn small onClick={()=>fileRef.current?.click()}>📂 Upload .json</Btn>
              </div>
            </div>
          </div>

          {/* COL 2: TOKEN LIBRARY + DETAILS */}
          <div style={{borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <PanelHead title="Token Library">
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text3)"}}>{tokens.length}</span>
            </PanelHead>

            <div style={{padding:"7px 9px",borderBottom:"1px solid var(--border)",background:"var(--s1)",flexShrink:0}}>
              <input
                value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search tokens…"
                style={{
                  width:"100%",padding:"5px 8px",background:"var(--s2)",
                  border:"1px solid var(--border)",color:"var(--text)",
                  fontSize:11,borderRadius:"var(--r)",outline:"none"
                }}
              />
            </div>

            <div style={{flex:1,overflow:"auto",padding:8}}>
              {!tokens.length ? (
                <Empty icon="🔑">Parse JSON to see tokens</Empty>
              ) : !filteredTokens.length ? (
                <Empty icon="🔍">No match for "{search}"</Empty>
              ) : Object.entries(groups).map(([group,gtokens])=>(
                <div key={group} style={{marginBottom:12}}>
                  <div style={{
                    fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",
                    color:"var(--text3)",paddingBottom:5,marginBottom:5,
                    borderBottom:"1px solid var(--border)"
                  }}>{group}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {gtokens.map(tok=>{
                      const sel=selectedToken?.path===tok.path;
                      return (
                        <div key={tok.path} draggable
                          onDragStart={e=>onTokenDragStart(e,tok.path)}
                          onClick={()=>setSelectedToken(sel?null:tok)}
                          style={{
                            display:"inline-flex",alignItems:"center",gap:5,
                            padding:"4px 8px",
                            background:sel?"rgba(170,255,94,0.15)":"var(--s2)",
                            border:`1px solid ${sel?"var(--lime)":"var(--border)"}`,
                            borderRadius:"var(--r)",fontFamily:"var(--mono)",fontSize:10,
                            color:sel?"var(--lime)":"var(--blue)",
                            cursor:"grab",userSelect:"none",transition:"all 0.12s",
                            boxShadow:sel?"0 0 0 2px rgba(170,255,94,0.2)":"none"
                          }}
                          title="Click to inspect · Drag to add to sequence"
                        >
                          <span style={{width:6,height:6,borderRadius:"50%",background:typeColor(tok.type),flexShrink:0}}/>
                          {tok.path}
                          {tok.isArray && (
                            <span style={{
                              fontSize:8,padding:"1px 4px",
                              background:"rgba(77,184,255,0.15)",border:"1px solid rgba(77,184,255,0.3)",
                              borderRadius:2,color:"var(--blue)"
                            }}>[ ]</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* DETAILS */}
            <div style={{flexShrink:0,borderTop:"1px solid var(--border)",background:"var(--s1)",maxHeight:220,overflow:"auto"}}>
              {selectedToken && tokenDetails ? (
                <div style={{padding:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",color:"var(--text3)"}}>Token Details</span>
                    <button onClick={()=>setSelectedToken(null)} style={{background:"none",border:"none",color:"var(--text3)",fontSize:12,padding:"1px 4px",borderRadius:3}}>✕</button>
                  </div>
                  <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--lime)",background:"var(--s2)",padding:"5px 8px",borderRadius:"var(--r)",border:"1px solid var(--border)",marginBottom:6,wordBreak:"break-all"}}>
                    {selectedToken.path}
                  </div>
                  <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                    <DTag label="Type" value={selectedToken.type} color={typeColor(selectedToken.type)}/>
                    <DTag label="Matches" value={tokenDetails.matchCount} color="var(--blue)"/>
                    {selectedToken.isArray && <DTag label="Array" value="multi-value" color="var(--orange)"/>}
                  </div>
                  {tokenDetails.sampleMatches.length>0 && (
                    <>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--text3)",marginBottom:4}}>Samples</div>
                      {tokenDetails.sampleMatches.map((m,i)=>(
                        <div key={i} style={{display:"flex",gap:5,alignItems:"center",padding:"2px 0",fontSize:10,fontFamily:"var(--mono)"}}>
                          <span style={{color:"var(--text3)",fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{m.path||selectedToken.path}</span>
                          <span style={{color:"var(--border2)"}}>→</span>
                          <span style={{color:typeColor(selectedToken.type),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {typeof m.value==="string"?`"${m.value}"`:String(m.value)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div style={{marginTop:8}}>
                    <Btn small accent onClick={()=>addToSequence(selectedToken.path)}>+ Add to Sequence</Btn>
                  </div>
                </div>
              ) : (
                <div style={{padding:"16px 12px",textAlign:"center",color:"var(--text3)",fontSize:11}}>
                  <div style={{fontSize:22,marginBottom:4}}>◈</div>
                  Click a token to inspect it
                </div>
              )}
            </div>
          </div>

          {/* COL 3: SEQUENCE BUILDER + RESULT */}
          <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Builder header */}
            <div style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"0 14px",height:40,
              borderBottom:"1px solid var(--border)",background:"var(--s1)",flexShrink:0
            }}>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text2)"}}>
                Token Sequence
                <span style={{marginLeft:8,fontSize:9,fontWeight:400,textTransform:"none",letterSpacing:0,color:"var(--text3)"}}>
                  reorder → output follows
                </span>
              </span>
              {sequence.length>0 && (
                <button onClick={clearSequence} style={{
                  fontSize:10,padding:"3px 8px",border:"1px solid transparent",
                  background:"none",color:"var(--text3)",borderRadius:"var(--r)",transition:"all 0.15s",
                  fontFamily:"var(--sans)"
                }}
                onMouseEnter={e=>{e.target.style.borderColor="var(--red)";e.target.style.color="var(--red)";}}
                onMouseLeave={e=>{e.target.style.borderColor="transparent";e.target.style.color="var(--text3)";}}
                >Clear All</button>
              )}
            </div>

            {/* DROP ZONE */}
            <div
              onDragOver={onZoneDragOver}
              onDragLeave={onZoneDragLeave}
              onDrop={onZoneDrop}
              style={{
                flex:"0 0 auto",minHeight:110,maxHeight:"55%",overflow:"auto",
                padding:8,
                background:dropHL?"rgba(170,255,94,0.04)":"var(--s2)",
                borderBottom:`1px solid ${dropHL?"rgba(170,255,94,0.4)":"var(--border)"}`,
                outline:dropHL?"2px dashed rgba(170,255,94,0.35)":"2px solid transparent",
                transition:"all 0.15s",position:"relative"
              }}
            >
              {sequence.length===0 ? (
                <div style={{
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  minHeight:90,color:dropHL?"var(--lime)":"var(--text3)",textAlign:"center",gap:6,
                  transition:"color 0.15s"
                }}>
                  <div style={{fontSize:28}}>⟶</div>
                  <div style={{fontSize:12}}>Drag tokens here to build your sequence</div>
                  <div style={{fontSize:11,opacity:0.6}}>Reorder them — the output follows</div>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {sequence.map((item,idx)=>{
                    const hasWarn=warnings.includes(item.id);
                    const isDragging=draggingIdx===idx;
                    const isOver=dragOverIdx===idx;
                    return (
                      <div key={item.id} draggable
                        onDragStart={e=>onItemDragStart(e,idx)}
                        onDragOver={e=>onItemDragOver(e,idx)}
                        onDrop={e=>onItemDrop(e,idx)}
                        onDragEnd={onItemDragEnd}
                        style={{
                          display:"flex",alignItems:"center",gap:5,
                          padding:"5px 8px",
                          background:isDragging?"var(--bg)":"var(--s1)",
                          border:`1px solid ${isOver?"var(--lime)":hasWarn?"var(--red)":"var(--border)"}`,
                          borderLeft:`3px solid ${hasWarn?"var(--red)":"var(--lime)"}`,
                          borderRadius:"var(--r)",
                          opacity:isDragging?0.4:1,
                          cursor:"grab",
                          transition:"border-color 0.12s,background 0.12s",
                          animation:"slideIn 0.18s ease"
                        }}
                      >
                        <span style={{color:"var(--text3)",fontSize:13,cursor:"grab",flexShrink:0}}>⠿</span>

                        {/* Index */}
                        <span style={{
                          fontFamily:"var(--mono)",fontSize:9,fontWeight:700,
                          padding:"1px 5px",background:"var(--bg)",
                          border:"1px solid var(--border)",borderRadius:3,
                          color:"var(--text3)",flexShrink:0,minWidth:18,textAlign:"center"
                        }}>{idx+1}</span>

                        {/* Path */}
                        <span style={{
                          fontFamily:"var(--mono)",fontSize:10.5,flex:1,
                          color:hasWarn?"var(--red)":"var(--lime)",
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
                        }}>{item.path}</span>

                        {hasWarn && <span style={{
                          fontSize:9,padding:"1px 5px",
                          background:"var(--red-dim)",border:"1px solid var(--red)",
                          borderRadius:2,color:"var(--red)",flexShrink:0
                        }}>⚠ missing</span>}

                        {/* TEXT mode: separator picker */}
                        {mode==="text" && (
                          <select value={item.sep??" "} onChange={e=>updateItem(item.id,{sep:e.target.value})}
                            onClick={e=>e.stopPropagation()}
                            style={{
                              padding:"2px 4px",fontSize:9,background:"var(--s2)",
                              border:"1px solid var(--border)",color:"var(--text2)",
                              borderRadius:3,flexShrink:0
                            }} title="Separator after this token"
                          >
                            {SEP.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )}

                        {/* OBJECT mode: key name */}
                        {mode==="object" && (
                          <input value={item.label??item.path}
                            onChange={e=>updateItem(item.id,{label:e.target.value})}
                            onClick={e=>e.stopPropagation()}
                            placeholder="key"
                            style={{
                              padding:"2px 6px",fontSize:10,width:85,
                              background:"var(--s2)",border:"1px solid var(--border)",
                              color:"var(--orange)",borderRadius:3,outline:"none",flexShrink:0
                            }}
                          />
                        )}

                        <button onClick={()=>moveItem(idx,idx-1)} disabled={idx===0}
                          style={{...IBtn,opacity:idx===0?0.2:1}} title="Move up">↑</button>
                        <button onClick={()=>moveItem(idx,idx+1)} disabled={idx===sequence.length-1}
                          style={{...IBtn,opacity:idx===sequence.length-1?0.2:1}} title="Move down">↓</button>
                        <button onClick={()=>removeItem(item.id)}
                          style={{...IBtn}}
                          onMouseEnter={e=>e.currentTarget.style.color="var(--red)"}
                          onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}
                          title="Remove">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RESULT OUTPUT */}
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"0 14px",height:40,
                borderBottom:"1px solid var(--border)",background:"var(--s1)",flexShrink:0
              }}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text2)"}}>
                  Result Output{" "}
                  <span style={{
                    marginLeft:6,fontSize:9,padding:"2px 7px",fontWeight:700,
                    textTransform:"uppercase",letterSpacing:0.5,borderRadius:3,
                    background:modeDim,border:`1px solid ${modeColor}44`,color:modeColor
                  }}>{mode}</span>
                </span>
                <div style={{display:"flex",gap:5}}>
                  <Btn small onClick={copyResult}>{copyMsg||"Copy"}</Btn>
                  <Btn small onClick={downloadResult}>Download</Btn>
                </div>
              </div>
              <div style={{flex:1,overflow:"auto",background:"var(--bg)",padding:"12px 16px"}}>
                {!sequence.length ? (
                  <span style={{color:"var(--text3)",fontSize:11,fontFamily:"var(--mono)",lineHeight:2}}>
                    {"// Add tokens above\n// Reorder them — output follows your sequence"}
                  </span>
                ) : !parsedJSON ? (
                  <span style={{color:"var(--red)",fontSize:11,fontFamily:"var(--mono)"}}>{"// No valid JSON loaded"}</span>
                ) : (
                  <div style={{fontFamily:"var(--mono)",fontSize:12,lineHeight:1.8,whiteSpace:"pre"}}
                    dangerouslySetInnerHTML={{__html:outputHTML}}
                  />
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// ── SMALL UI PIECES ───────────────────────────────────────────────────────────

function PanelHead({title,children}){
  return (
    <div style={{
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"0 14px",height:40,
      borderBottom:"1px solid var(--border)",background:"var(--s1)",flexShrink:0
    }}>
      <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--text2)"}}>{title}</span>
      {children}
    </div>
  );
}

function Chip({children,color="var(--text3)"}){
  return (
    <span style={{
      fontFamily:"var(--mono)",fontSize:10,padding:"2px 7px",
      background:"var(--s2)",border:"1px solid var(--border)",
      borderRadius:3,color
    }}>{children}</span>
  );
}

function Btn({children,onClick,small,accent}){
  return (
    <button onClick={onClick} style={{
      padding:small?"4px 10px":"6px 14px",
      fontSize:small?10:12,fontWeight:700,letterSpacing:0.5,
      border:accent?"1px solid var(--lime)":"1px solid var(--border)",
      background:accent?"var(--lime-dim)":"var(--s2)",
      color:accent?"var(--lime)":"var(--text2)",
      borderRadius:"var(--r)",transition:"opacity 0.15s",whiteSpace:"nowrap"
    }}
    onMouseEnter={e=>e.currentTarget.style.opacity="0.75"}
    onMouseLeave={e=>e.currentTarget.style.opacity="1"}
    >{children}</button>
  );
}

function DTag({label,value,color}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:1}}>
      <span style={{fontSize:8,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--text3)"}}>{label}</span>
      <span style={{fontFamily:"var(--mono)",fontSize:10,color,background:"var(--s2)",padding:"2px 6px",borderRadius:3,border:"1px solid var(--border)"}}>{value}</span>
    </div>
  );
}

function Empty({children,icon}){
  return (
    <div style={{textAlign:"center",padding:"28px 10px",color:"var(--text3)",fontSize:12,lineHeight:1.8}}>
      {icon&&<div style={{fontSize:26,marginBottom:6}}>{icon}</div>}
      {children}
    </div>
  );
}

const IBtn={background:"none",border:"none",color:"var(--text3)",fontSize:11,
  padding:"2px 4px",borderRadius:3,lineHeight:1,transition:"color 0.12s",cursor:"pointer"};
