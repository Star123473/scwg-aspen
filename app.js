'use strict';
const $ = (s, root=document) => root.querySelector(s);
const esc = (s='') => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={flask:'M9 3h6m-5 0v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M8 15h8',home:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',layers:'m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',flow:'M3 3h7v6H3zm11 12h7v6h-7zM7 9v9h7m-4-12h7v9',book:'M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zm10 3a3 3 0 0 1 3-3h4v13h-4a3 3 0 0 0-3 3',chart:'M3 3v18h18M7 16l4-5 4 2 5-7',list:'M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1',alert:'m12 3 10 17H2zm0 6v5m0 3h.01',file:'M5 3h9l5 5v13H5zm9 0v6h5M8 13h8m-8 4h8',download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',plus:'M12 5v14M5 12h14',menu:'M3 6h18M3 12h18M3 18h18',close:'m6 6 12 12M18 6 6 18',check:'m4 12 5 5L20 6',arrow:'M4 12h16m-6-6 6 6-6 6',save:'M4 3h14l3 3v15H3V3zm3 0v6h10V3M7 21v-7h10v7'};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
const navGroups=[['研究管理',[['overview','项目总览','home'],['material','原料表征','layers'],['model','Aspen 模型','flow'],['stages','研究阶段','list']]],['模拟与成果',[['runs','模拟记录','flask'],['compare','情景对比','chart'],['checks','质量检查','alert'],['report','论文与汇报','file']]]];
const nav=navGroups.flatMap(g=>g[1]);
const stages=[
 ['原料表征','收集样品来源、工业分析、元素分析、木质纤维素与灰分数据','material'],
 ['流程搭建','建立 Aspen Plus 流程图，登记设备、物流与组分','model'],
 ['反应与平衡设置','记录反应路径、物性方法、平衡方程及衡算边界','model'],
 ['参数敏感性分析','定义基准工况与变量，比较输出指标','compare'],
 ['结果验证','核对收敛、衡算与文献或实测数据','checks'],
 ['论文与汇报准备','整理研究方法、关键图表与下一步计划','report']
];
const outline=['研究背景与研究问题','原料表征与数据来源','Aspen Plus 流程与模型假设','工况设计与敏感性分析','结果验证、异常与局限','结论与下一步计划'];
const categories=['工业分析','元素分析','木质纤维素','灰分组分','其他'];
const materialRows=[
 ['工业分析','水分'],['工业分析','挥发分'],['工业分析','固定碳'],['工业分析','灰分'],
 ...['C','H','O','N','S'].map(v=>['元素分析',v]),
 ...['纤维素','半纤维素','木质素'].map(v=>['木质纤维素',v])
].map(([category,name])=>({category,name,value:'',unit:'wt%',basis:'',source:''}));
const inputs=[['temperature','反应温度','°C'],['pressure','反应压力','MPa'],['residence','停留时间','min'],['feed','干基进料浓度','wt%'],['co2','二氧化碳注入量','g CO₂/kg 干原料']];
const outputs=[['hydrogen','氢气产率','mol H₂/kg 干原料'],['carbon','碳转化率','%'],['efficiency','能量效率','%']];
const components=['H₂','CO₂','CO','CH₄','其他'];
const taskStatuses=['待开展','进行中','已完成'];
const makeState=()=>({schema:1,material:{sample:'',pretreatment:'',notes:'',rows:structuredClone(materialRows)},model:{version:'',method:'',reactor:'',reactionPath:'',equilibrium:'',mass:'',energy:'',assumptions:'',flowNodes:[],image:null,components:[],reactions:[],items:[],refs:[]},runs:[],tasks:stages.map(()=>({status:'待开展',notes:''})),report:outline.map(()=>''),updated:''});
let state=makeState(), revision=null, available=false, loadError='', saving=false, page='overview', selected=new Set(), baseId='', axis='temperature', metric='hydrogen', toastTimer;
const dialog=$('#dialog'), main=$('#main');
const emptyString = v => v==null || String(v).trim()==='';
const present = v => !emptyString(v);
const val = v => present(v)?esc(v):'<span class="muted">待确认</span>';
const number = v => present(v)&&Number.isFinite(Number(v))?Number(v):null;
const range = (v,min,max) => number(v)!==null&&(number(v)<min||number(v)>max);
const options=(items,value)=>items.map(item=>'<option'+(value===item?' selected':'')+'>'+esc(item)+'</option>').join('');
const pill=(v,style='')=>'<span class="pill '+style+'">'+esc(v)+'</span>';
const statusPill=v=>pill(v,v==='已完成'||v==='已收敛'?'green':v==='进行中'?'blue':v==='未收敛'?'warn':'');
const button=(label, action, ico='', cls='light',extra='')=>'<button type="button" class="btn '+cls+'" data-action="'+action+'" '+extra+'>'+(ico?icon(ico):'')+esc(label)+'</button>';
const saveButton=()=>'<div class="form-actions"><button class="btn primary" type="submit" '+(!available?'disabled':'')+'>'+icon('save')+'保存修改</button></div>';
const pageTitle=(title,desc,actions='')=>'<div class="page-title"><div><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div>'+actions+'</div>';
const panel=(title,body,actions='',cls='')=>'<section class="panel '+cls+'"><div class="panel-head"><h2>'+esc(title)+'</h2>'+actions+'</div><div class="panel-body">'+body+'</div></section>';
const empty=(label,ico='file')=>'<div class="empty"><div class="empty-icon">'+icon(ico)+'</div>'+esc(label)+'</div>';
const field=(name,label,value='',type='text',extra={})=>{
 const start='<label class="field '+(extra.wide?'wide':'')+'"><span>'+esc(label)+'</span>';
 const attr=' name="'+name+'"';
 if(type==='textarea')return start+'<textarea'+attr+' placeholder="待确认">'+esc(value)+'</textarea></label>';
 if(type==='select')return start+'<select'+attr+'>'+options(extra.options,value)+'</select></label>';
 return start+'<input type="'+type+'"'+attr+' value="'+esc(value)+'" placeholder="'+esc(extra.placeholder??'待确认')+'" '+(type==='number'?'step="any" ':'')+(extra.required?'required':'')+'></label>';
};
const inputGrid=(spec,obj)=>spec.map(([k,label,unit])=>field(k,label+'（'+unit+'）',obj[k],'number')).join('');
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const tr=cells=>'<tr>'+cells.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
const capturedForm=form=>Object.fromEntries(new FormData(form).entries());
const formatTime=iso=>iso?new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Shanghai'}).format(new Date(iso)):'';

function checks() {
  const all=[];
  const add=(area,title,detail)=>all.push({area,title,detail});
  const m=state.model, raw=state.material;
  const missing=raw.rows.filter(x=>emptyString(x.value));
  if(missing.length||!raw.rows.length) add('material','原料数据缺失',missing.length?missing.map(x=>x.name).join('、'):'尚未登记原料数据');
  const invalid=raw.rows.filter(x=>present(x.value)&&(!['wt%','%','mg/kg','g/kg'].includes(x.unit)||emptyString(x.basis)||number(x.value)===null||range(x.value,0,['wt%','%'].includes(x.unit)?100:Infinity)));
  if(invalid.length) add('material','原料单位、基准或数值待核对',invalid.map(x=>x.name).join('、'));
  const units=new Set(raw.rows.filter(x=>present(x.value)&&x.category==='元素分析').map(x=>x.unit+' / '+x.basis));
  if(units.size>1) add('material','元素分析口径不一致','同组录入使用了不同单位或分析基准，请先统一口径再使用。');
  if(raw.rows.some(x=>present(x.value)&&emptyString(x.source))) add('material','原料数据来源待确认','补充实测报告、表格或文献定位。');
  const defined=new Map(m.components.map(c=>[c.id.trim(),c]));
  if(!defined.size) add('model','组分未定义','尚未登记 Aspen 组分 ID。');
  const referenced=m.items.flatMap(x=>x.components.split(/[,，、\s]+/).filter(Boolean));
  const undefinedIds=[...new Set(referenced.filter(x=>!defined.has(x)))];
  if(undefinedIds.length) add('model','物流或设备引用了未定义组分',undefinedIds.join('、'));
  if(!m.reactions.length) add('model','反应方程式待确认','登记反应方程式及化学计量后可检查元素闭合。');
  for(const r of m.reactions){
    const result=checkReaction(r,defined);
    if(result) add('model','反应 '+r.name+' · '+result[0],result[1]);
  }
  const propertyMissing=[['method','热力学方法'],['reactor','反应器设置'],['reactionPath','反应路径'],['equilibrium','平衡方程'],['mass','物料衡算'],['energy','能量衡算']].filter(([k])=>emptyString(m[k])).map(x=>x[1]);
  if(propertyMissing.length) add('model','模型依据待确认',propertyMissing.join('、'));
  const notClosed=m.items.filter(x=>x.type==='物流'&&x.status==='未收敛');
  if(notClosed.length) add('model','物流未收敛',notClosed.map(x=>x.name).join('、'));
  if(!present(m.assumptions)||!m.refs.length||m.refs.some(r=>[r.title,r.location,r.assumption].some(emptyString))||m.assumptions.split('\n').map(x=>x.trim()).filter(Boolean).some(x=>!m.refs.some(r=>r.assumption.trim()===x&&present(r.title)&&present(r.location)))) add('model','文献与模型假设对应不足','每项模型假设单独一行，文献条目填写题名、定位和对应的完整假设。');
  for(const r of state.runs){
    const label=r.name+' / '+r.version;
    if(r.status==='未收敛') add('runs','模拟未收敛',label);
    if(r.status==='已收敛'&&[...inputs,...outputs].some(([k])=>emptyString(r[k]))) add('runs','已收敛记录仍缺少输入或结果',label);
    if((r.co2Unit && r.co2Unit!=='g CO₂/kg 干原料')||(r.hydrogenUnit && r.hydrogenUnit!=='mol H₂/kg 干原料')||(r.gasBasis && r.gasBasis!=='干基 mol%')) add('runs','模拟结果或投料单位需统一',label+'。对比图会按口径筛选。');
    const gas=components.map((_,i)=>number(r['gas'+i]));
    if(r.anomaly||range(r.pressure,0,Infinity)||number(r.pressure)===0||range(r.residence,0,Infinity)||range(r.feed,0,100)||range(r.co2,0,Infinity)||range(r.hydrogen,0,Infinity)||range(r.carbon,0,100)||range(r.efficiency,0,100)||gas.some(v=>v!==null&&(v<0||v>100))||(gas.every(v=>v!==null)&&Math.abs(gas.reduce((sum,v)=>sum+v,0)-100)>0.5)) add('runs','结果或工况异常待复核',label+(r.anomaly?' · '+r.anomaly:' · 检查输入范围、指标百分数和气体总和。'));
  }
  return all;
}
function formulaElements(formula) {
  const tokens=formula.match(/[A-Z][a-z]?|\d+|[()]/g)||[];
  if(!tokens.length||tokens.join('')!==formula) return null;
  const stack=[{}];
  const merge=(target,part,n)=>{for(const [e,v] of Object.entries(part))target[e]=(target[e]||0)+n*v};
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(t==='('){stack.push({});continue}
    if(t===')'&&stack.length===1||/^\d/.test(t))return null;
    const part=t===')'?stack.pop():{[t]:1};
    if(!Object.keys(part).length)return null;
    const n=/^\d/.test(tokens[i+1]??'')?Number(tokens[++i]):1;
    if(!Number.isSafeInteger(n)||n<1)return null;
    merge(stack.at(-1),part,n);
  }
  return stack.length===1?stack[0]:null;
}
function checkReaction(r,defined) {
  if(!r.equation.trim())return ['待确认','请录入反应方程式。'];
  const sides=r.equation.split(/<=>|<->|=>|->|⇌|→|=/);
  if(sides.length!==2)return ['格式待确认','使用“系数 组分ID + 组分ID -> 组分ID”格式。'];
  const diff={};
  for(const [i,side] of sides.entries()){
    for(const piece of side.split('+')){
      const match=piece.trim().match(/^(?:(\d+(?:\.\d+)?|\.\d+)\s+)?(\S+)$/);
      if(!match||Number(match[1])===0)return ['格式待确认','系数须为正数并用空格与组分 ID 分隔。'];
      const c=defined.get(match[2]);
      if(!c)return ['组分未定义',match[2]];
      const counts=formulaElements(c.formula.trim());
      if(!counts)return ['分子式待确认',match[2]+' 缺少可解析的中性分子式。'];
      for(const [e,n] of Object.entries(counts))diff[e]=(diff[e]||0)+(i===0?1:-1)*n*Number(match[1]??1);
    }
  }
  const differences=Object.entries(diff).filter(([,n])=>Math.abs(n)>1e-8);
  return differences.length?['元素未闭合',differences.map(([e,n])=>e+' 左减右 '+Number(n.toPrecision(6))).join('、')]:null;
}
function alertList(items){
 return items.length?items.map(x=>'<div class="alert">'+icon('alert')+'<div><a href="#'+x.area+'">'+esc(x.title)+'</a><p class="break">'+esc(x.detail)+'</p></div></div>').join(''):empty('当前没有待检查项。','check');
}
function heroArt(){
 return '<svg class="hero-art" viewBox="0 0 450 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0v22" fill="none" stroke="#8ab5ff" stroke-opacity=".22"/></pattern><linearGradient id="fade"><stop stop-color="white" stop-opacity="0"/><stop offset=".45" stop-color="white"/></linearGradient><mask id="mask"><rect width="450" height="230" fill="url(#fade)"/></mask></defs><g mask="url(#mask)"><rect width="450" height="230" fill="url(#grid)"/><g fill="none" stroke="#9dc7ff" stroke-width="1.5"><path d="M21 121h67m42 0h49V73h62m63 0h54v45h48m-102 44h54v-44m-117 44h-44v-41h-18"/><rect x="88" y="100" width="42" height="42" rx="8"/><rect x="241" y="50" width="63" height="137" rx="26"/><path d="M241 89h63m-63 64h63m-46-30c9-24 17 23 29-5m119-15h29v30h-29z"/><circle cx="179" cy="121" r="4" fill="#a7ceff"/><circle cx="358" cy="118" r="4" fill="#a7ceff"/></g><g fill="#c3ddff" font-size="10" font-family="monospace" letter-spacing="2"><text x="227" y="208">SCWG REACTOR</text><text x="326" y="43">PROCESS</text><text x="365" y="155">H₂</text></g></g></svg>';
}
function overview(){
 const alerts=checks(), ready=state.material.rows.filter(x=>present(x.value)).length, done=state.tasks.filter(x=>x.status==='已完成').length;
 const stats=[['原料数据录入',ready+' / '+state.material.rows.length,'已填写数值 / 已登记项目','layers','material'],['模拟记录',state.runs.length,state.runs.filter(x=>x.status==='已收敛').length+' 条已收敛','flask','runs'],['研究阶段',done+' / '+stages.length,'已完成阶段','list','stages'],['待检查项',alerts.length,'数据与模型质量检查','alert','checks']];
 return '<section class="hero">'+heroArt()+'<div><div class="kicker">'+icon('flask')+' 油茶壳研究项目</div><h1>超临界水气化制氢<br>Aspen 模拟研究工作台</h1><p>组织工况、跟踪模拟版本，核对结果并准备研究汇报。</p><div class="tags"><span>油茶壳</span><span>Aspen Plus</span><span>SCWG</span></div></div></section><div class="grid stats">'+stats.map(([title,note,sub,ico,link])=>'<a class="stat" href="#'+link+'"><div class="stat-top">'+esc(title)+'<span class="stat-icon">'+icon(ico)+'</span></div><strong>'+esc(note)+'</strong><small>'+esc(sub)+'</small></a>').join('')+'</div><div class="grid split">'+panel('研究路线',stages.map(([title,desc],i)=>'<div class="stage"><span class="stage-num">'+String(i+1).padStart(2,'0')+'</span><div><strong>'+title+'</strong><p>'+desc+'</p></div>'+statusPill(state.tasks[i].status)+'</div>').join(''),'<a class="text-link" href="#stages">管理阶段 →</a>')+panel('优先核对',alertList(alerts.slice(0,5)),'<a class="text-link" href="#checks">查看全部 →</a>')+'</div><div class="section-gap">'+panel('最近模拟',state.runs.length?runTable([...state.runs].reverse().slice(0,4)):empty('暂无模拟记录。完成 Aspen Plus 计算后，录入版本、工况与结果。','flask'),'<a class="text-link" href="#runs">查看记录 →</a>')+'</div>';
}
function material(){
 const obj=state.material;
 return pageTitle('原料表征','记录油茶壳样品、分析基准和数据来源。')+'<form data-form="material">'+panel('样品信息','<div class="field-grid">'+field('sample','样品编号与来源',obj.sample)+field('pretreatment','预处理与检测方法',obj.pretreatment)+field('notes','采样、测定与换算备注',obj.notes,'textarea',{wide:true})+'</div>')+
 '<div class="section-gap">'+panel('工业分析、元素分析与组分','<p class="notice">录入数值时同时核对单位和基准。灰分总量列在工业分析中，灰分组成可添加为独立项目。</p>'+
 table(['类别','项目','数值','单位','基准','来源 / 定位','操作'],obj.rows.map((r,i)=>tr([
 '<select aria-label="类别" name="m'+i+'-category">'+options(categories,r.category)+'</select>',
 rawInput(i,'name',r.name,'项目'),rawInput(i,'value',r.value,'数值','number'),rawInput(i,'unit',r.unit,'单位'),
 '<select aria-label="基准" name="m'+i+'-basis">'+options(['待确认','收到基','干基','干燥无灰基','灰分基','其他'],r.basis||'待确认')+'</select>',
 rawInput(i,'source',r.source,'来源'),button('移除','remove-material','','danger','data-index="'+i+'"')
 ])))+saveButton(),button('添加项目','add-material','plus'))+'</div></form>';
}
function rawInput(i,key,value,label,type='text'){return '<input type="'+type+'" aria-label="'+label+'" name="m'+i+'-'+key+'" value="'+esc(value)+'" placeholder="待确认" '+(type==='number'?'step="any"':'')+'>'}
function readMaterial(form){
 const d=capturedForm(form),rows=[...form.querySelectorAll('input[name$="-name"]')].map(input=>input.name.split('-')[0]).map(prefix=>Object.fromEntries(['category','name','value','unit','basis','source'].map(k=>[k,d[prefix+'-'+k]==='待确认'?'':d[prefix+'-'+k]])));
 return {sample:d.sample,pretreatment:d.pretreatment,notes:d.notes,rows};
}
const settings=[['version','Aspen Plus 版本 / 模型文件名'],['method','热力学物性方法'],['reactor','反应器类型及关键设置'],['reactionPath','反应路径 / 适用边界'],['equilibrium','平衡方程及约束'],['mass','物料衡算与闭合误差定义'],['energy','能量衡算及热值基准'],['assumptions','模型假设（每行一项）'],['flowNodes','流程节点（每行一项，按主流程排列）']];
const modelLists={
 components:{title:'组分定义',headers:['Aspen ID','分子式','说明'],fields:[['id','Aspen ID'],['formula','分子式（使用 ASCII，如 H2O）'],['note','说明、组分类型或来源','textarea']]},
 reactions:{title:'化学反应方程式',headers:['反应名','方程式','闭合检查'],fields:[['name','反应名'],['equation','方程式（用 Aspen ID，系数后加空格）','textarea'],['note','来源、反应类型或参数','textarea']]},
 items:{title:'物流与设备参数',headers:['对象','类型','参数 / 单位','组分 ID','收敛'],fields:[['name','Aspen 对象名'],['type','类型','select',['物流','设备']],['parameters','参数、单位与计算基准','textarea'],['components','组分 ID（逗号分隔）'],['status','收敛状态','select',['待确认','已收敛','未收敛']]]},
 refs:{title:'文献与模型假设',headers:['题名','来源 / 定位','模型假设'],fields:[['title','文献或实验记录题名'],['location','DOI、网址、页码或表号'],['assumption','对应的完整模型假设'],['note','引用的数据或支持范围','textarea']]}
};
function model(){
 const m=state.model;
 const img=m.image&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(m.image.data)?'<img class="flow-img" src="'+esc(m.image.data)+'" alt="上传的 Aspen 流程图"><p class="small muted break">'+esc(m.image.name)+'</p>'+button('移除当前附图','remove-image','','danger'):'';
 const diagram=m.flowNodes.length?'<div class="flow">'+m.flowNodes.map((n,i)=>(i?'<span class="flow-arrow">'+icon('arrow')+'</span>':'')+'<div class="flow-node">'+esc(n)+'</div>').join('')+'</div>':empty('流程节点待确认。可录入节点或上传 Aspen 流程图。','flow');
 const groups=Object.entries(modelLists).map(([key,spec])=>{
  const rows=m[key].map((r,i)=>{
   const edit=button('查看 / 编辑','model-edit','','light','data-key="'+key+'" data-index="'+i+'"');
   const cells=key==='components'?[val(r.id),val(r.formula),val(r.note)]:key==='reactions'?[val(r.name),val(r.equation),r.equation?(checkReaction(r,new Map(m.components.map(c=>[c.id.trim(),c])))?pill('需核对','warn'):pill('元素闭合','green')):val('')]:key==='items'?[val(r.name),val(r.type),'<pre>'+val(r.parameters)+'</pre>',val(r.components),statusPill(r.status)]:[val(r.title),val(r.location),val(r.assumption)];
   return tr([...cells,edit]);
  });
  return '<div class="section-gap">'+panel(spec.title,rows.length?table([...spec.headers,'操作'],rows):empty('暂无记录 · 待确认'),button('添加','model-edit','plus','light','data-key="'+key+'"'))+'</div>';
 }).join('');
 return pageTitle('Aspen 模型','管理流程拓扑、模型设置、反应方程与可追溯依据。')+panel('流程图',diagram+img+'<div class="section-gap"><label class="field">上传 Aspen 流程图（PNG / JPG / WebP，最多 2 MB）<input type="file" id="flow-image" accept="image/png,image/jpeg,image/webp" '+(!available?'disabled':'')+'></label></div>')+
 '<div class="section-gap"><form data-form="model">'+panel('反应器、热力学与衡算设置','<div class="field-grid">'+settings.map(([k,label],i)=>field(k,label,k==='flowNodes'?m[k].join('\n'):m[k],i<2?'text':'textarea',{wide:k==='flowNodes'})).join('')+'</div>'+saveButton())+'</form></div>'+groups;
}
function stagesPage(){
 return pageTitle('研究阶段','按研究顺序跟踪任务、完成状态和下一步。')+'<form data-form="tasks"><div class="grid two forms">'+stages.map(([name,desc,link],i)=>panel(String(i+1).padStart(2,'0')+'  '+name,'<p class="muted">'+desc+'</p><div class="field-grid">'+field('status'+i,'阶段状态',state.tasks[i].status,'select',{options:taskStatuses})+field('note'+i,'阶段任务、进度与下一步（可逐条记录）',state.tasks[i].notes,'textarea',{wide:true})+'</div>','<a class="text-link" href="#'+link+'">进入工作区 →</a>')).join('')+'</div>'+saveButton()+'</form>';
}
const runSpecs=[['name','情景名称'],['version','模拟版本 / Aspen 文件名'],['date','运行日期','date'],['status','收敛状态','select',['待确认','已收敛','未收敛']],['agent','气化剂及用量'],['caseNote','模型与输入快照（物性方法、设备、反应或文件定位）','textarea'],['co2Unit','CO₂ 注入量单位','select',['g CO₂/kg 干原料','其他 / 待确认']],['hydrogenUnit','氢气产率单位','select',['mol H₂/kg 干原料','其他 / 待确认']],['gasBasis','气体组成口径','select',['干基 mol%','湿基 mol%','其他 / 待确认']],['metricBasis','碳转化率、能效定义及结果来源','textarea'],['anomaly','异常结果','textarea'],['open','待确认事项','textarea'],['next','下一步计划','textarea']];
function checkBox(r){return '<label class="check-select"><input type="checkbox" data-pick="'+esc(r.id)+'" '+(selected.has(r.id)?'checked':'')+' aria-label="选中 '+esc(r.name)+' 用于情景对比"></label>'}
function runTable(records,withChoice=false) {
 return table([...(withChoice?['对比']:[]),'情景 / 版本','日期','收敛','反应温度 °C','反应压力 MPa','氢气产率','操作'],records.map(r=>tr([
 ...(withChoice?[checkBox(r)]:[]),'<b>'+esc(r.name)+'</b><br><small class="muted">'+esc(r.version)+'</small>',val(r.date),statusPill(r.status),val(r.temperature),val(r.pressure),present(r.hydrogen)?esc(r.hydrogen)+' <span class="small muted">'+esc(r.hydrogenUnit)+'</span>':val(''),button('查看 / 编辑','edit-run','','light','data-id="'+esc(r.id)+'"')
 ])));
}
function runs(){
 const records=[...state.runs].reverse();
 return pageTitle('模拟记录','按版本记录 Aspen Plus 工况、结果和验证事项。')+panel('模拟版本台账',records.length?runTable(records,true):empty('暂无模拟。点击「新增模拟」登记第一条记录。','flask'),'<a class="text-link" href="#compare">前往情景对比 →</a>');
}
const formatMetric=(r,k)=>k==='co2'&&r.co2Unit!=='g CO₂/kg 干原料'?esc(r[k])+'（'+esc(r.co2Unit)+'）':k==='hydrogen'&&r.hydrogenUnit!=='mol H₂/kg 干原料'?esc(r[k])+'（'+esc(r.hydrogenUnit)+'）':val(r[k]);
function compare(){
 const records=state.runs.filter(r=>selected.has(r.id));
 const reference=records.find(r=>r.id===baseId);
 const lookup=(fields,key)=>fields.find(x=>x[0]===key);
 const selectSpec=(name,fields,value)=>'<select aria-label="'+(name==='axis'?'横轴':'纵轴')+'" data-choice="'+name+'">'+fields.map(([k,l,u])=>'<option value="'+k+'" '+(k===value?'selected':'')+'>'+esc(l+' / '+u)+'</option>').join('')+'</select>';
 const results=records.length?table(['指标',...records.map(r=>r.name+' / '+r.version+(r===reference?'（基准）':''))],[
  tr(['收敛状态',...records.map(r=>statusPill(r.status))]),
  tr(['气化剂',...records.map(r=>val(r.agent))]),
  ...[...inputs,...outputs].map(([k,l,u])=>tr([esc(l+' / '+u),...records.map(r=>formatMetric(r,k))])),
  tr(['气体组成口径',...records.map(r=>val(r.gasBasis))]),
  ...components.map((c,i)=>tr([esc(c+' / mol%'),...records.map(r=>val(r['gas'+i]))])),
  tr(['指标定义与来源',...records.map(r=>val(r.metricBasis))]),
  tr(['异常结果',...records.map(r=>val(r.anomaly))])
 ]):empty('请至少勾选一个模拟情景。','chart');
 const choices=state.runs.length?'<div class="list-status">'+state.runs.map(r=>'<label class="btn check-select"><input type="checkbox" data-pick="'+esc(r.id)+'" '+(selected.has(r.id)?'checked':'')+'>'+esc(r.name)+' · '+esc(r.version)+'</label>').join('')+'</div><label class="field">高亮基准情景<select data-choice="base"><option value="">待确认</option>'+records.map(r=>'<option value="'+esc(r.id)+'" '+(r===reference?'selected':'')+'>'+esc(r.name+' · '+r.version)+'</option>').join('')+'</select></label>':empty('先登记模拟，再选择对比情景。','flask');
 const plotRecords=records.filter(r=>r.status==='已收敛'&&number(r[axis])!==null&&number(r[metric])!==null&&(axis!=='co2'||r.co2Unit==='g CO₂/kg 干原料')&&(metric!=='hydrogen'||r.hydrogenUnit==='mol H₂/kg 干原料'));
 const variations=inputs.filter(([key])=>key!==axis&&new Set(plotRecords.map(r=>r[key]+(key==='co2'?' '+r.co2Unit:''))).size>1).map(x=>x[1]);
 const chart=plotRecords.length?drawChart(plotRecords,lookup(inputs,axis),lookup(outputs,metric)):empty('暂无可绘制的已收敛数据。请选择具备数值且单位一致的情景。','chart');
 return pageTitle('情景对比','比较不同温度、压力、停留时间、进料浓度和 CO₂ 注入量下的模拟结果。', '<a class="btn" href="#runs">模拟记录 →</a>')+panel('选择情景',choices)+'<div class="section-gap">'+panel('工况与结果对照表',results)+'</div><div class="section-gap">'+panel('结果趋势图','<div class="field-grid"><label class="field">横轴'+selectSpec('axis',inputs,axis)+'</label><label class="field">纵轴'+selectSpec('metric',outputs,metric)+'</label></div><p class="small muted">图中包含 '+plotRecords.length+' / '+records.length+' 条所选记录。仅绘制已收敛且口径符合坐标单位的数据。</p>'+(variations.length?'<p class="notice">同时变化的其他工况包括 '+esc(variations.join('、'))+'。请结合对照表判断变量影响。</p>':'')+chart)+'</div>';
}
function drawChart(records,[xkey,xlabel,xunit],[ykey,ylabel,yunit]){
 const xs=records.map(r=>number(r[xkey])),ys=records.map(r=>number(r[ykey]));
 const scale=(values,a,b)=>{const min=Math.min(...values),max=Math.max(...values),pad=(max-min||Math.abs(max)*.08||1)*.12;return {low:min-pad,high:max+pad,pos:v=>a+(b-a)*(v-min+pad)/(max-min+2*pad)}};
 const x=scale(xs,95,724),y=scale(ys,246,28);
 const nice=v=>Number(v.toPrecision(4));
 return '<svg class="chart" viewBox="0 0 750 302" role="img" aria-label="'+esc(xlabel+' 与 '+ylabel+' 的情景散点图')+'">'+Array.from({length:5},(_,i)=>{
   const a=x.low+(x.high-x.low)*i/4,b=y.low+(y.high-y.low)*i/4;
   return '<path d="M95 '+y.pos(b)+'H724" stroke="#e2eaf5"/><text x="85" y="'+(y.pos(b)+4)+'" text-anchor="end">'+nice(b)+'</text><text x="'+x.pos(a)+'" y="263" text-anchor="middle">'+nice(a)+'</text>';
 }).join('')+'<path d="M95 28v218h629" fill="none" stroke="#839abb"/><text x="410" y="289" text-anchor="middle">'+esc(xlabel+' / '+xunit)+'</text><text x="20" y="137" text-anchor="middle" transform="rotate(-90 20 137)">'+esc(ylabel+' / '+yunit)+'</text>'+records.map((r,i)=>'<circle cx="'+x.pos(xs[i])+'" cy="'+y.pos(ys[i])+'" r="'+(r.id===baseId?8:5.5)+'" fill="'+(r.id===baseId?'#087b63':'#2b61df')+'" stroke="white" stroke-width="1.3"><title>'+esc(r.name+' / '+r.version+' · '+xs[i]+xunit+' · '+ys[i]+yunit)+'</title></circle>').join('')+'</svg>';
}
function report(){
 const list='<ol class="outline">'+outline.map((label,i)=>'<li><strong>'+label+'</strong><p>'+val(state.report[i])+'</p></li>').join('')+'</ol>';
 return pageTitle('论文与汇报','维护汇报提纲，整理图表、模型依据和待确认问题。',button('导出提纲','export-outline','download'))+'<div class="grid two forms">'+panel('汇报提纲预览',list)+'<form data-form="report">'+panel('编辑提纲','<div class="field-grid">'+outline.map((l,i)=>field('r'+i,l,state.report[i],'textarea',{wide:true})).join('')+'</div>'+saveButton())+'</form></div><div class="section-gap">'+panel('汇报素材','<div class="tags"><a class="btn" href="#material">原料参数表</a><a class="btn" href="#model">Aspen 流程图</a><a class="btn" href="#compare">情景及趋势图</a><a class="btn" href="#checks">异常与验证项</a></div>')+'</div>';
}
function checksPage(){
 const items=checks();
 return pageTitle('质量检查','检查一次录入即可发现的缺失、口径冲突和元素守恒问题。')+panel('待核对清单',alertList(items),pill(items.length+' 项',items.length?'warn':'green'))+'<div class="section-gap">'+panel('核对范围','<p class="muted">物流收敛和模拟收敛采用你在 Aspen Plus 中确认后录入的状态。元素闭合检查适用于已定义中性分子式及带计量系数的反应。指标异常按已录入数值的基本范围和气体组分总和提示。</p>')+'</div>';
}
const renderers={overview,material,model,stages:stagesPage,runs,compare,checks:checksPage,report};
function render(){
 const active=nav.find(n=>n[0]===page);
 $('#location').textContent=active[1];
 $('#navigation').innerHTML=navGroups.map(([group,items])=>'<section class="nav-group"><h2>'+group+'</h2>'+items.map(([id,label,ico])=>'<a class="nav-link" href="#'+id+'" '+(page===id?'aria-current="page"':'')+'>'+icon(ico)+esc(label)+'</a>').join('')+'</section>').join('');
 main.innerHTML=(available?'':'<p class="notice '+(loadError?'error':'')+'">'+esc(loadError||'正在加载研究数据…')+(loadError?' '+button('重新连接','reload'):'')+'</p>')+renderers[page]()+footer();
}
function footer(){
 return '<div class="save-line">数据保存在当前浏览器，请定期导出备份。 · '+(state.updated?'最近保存 '+esc(formatTime(state.updated))+' · ':'')+'<button class="text-link" data-action="import">从 JSON 恢复</button></div>';
}
function route(){
 const key=location.hash.slice(1);
 page=Object.hasOwn(renderers,key)?key:'overview';
 $('#sidebar').classList.remove('open');
 $('#menu').setAttribute('aria-expanded','false');
 render();
 window.scrollTo(0,0);
}
function toast(message){
 $('#toast').textContent=message;
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{$('#toast').textContent=''},6300);
}
const storageKey='scwg-aspen-workspace-v1';
async function loadWorkspace(){
 try{
   const raw=localStorage.getItem(storageKey);
   const restored=raw?JSON.parse(raw):null;
   if(restored&&!validState(restored))throw new Error('本地数据格式不兼容，请先保留备份');
   state=restored||makeState();
   loadError='';available=true;
 }catch(e){loadError=e.message||'无法读取浏览器存储';available=false}
 render();
}
let failedDraft=null;
async function persist(next,success='修改已保存'){
 if(!available||saving)return false;
 saving=true;next.updated=new Date().toISOString();
 try{
   localStorage.setItem(storageKey,JSON.stringify(next));
   state=next;failedDraft=null;render();toast(success);return true;
 }catch(error){failedDraft=next;toast('浏览器存储失败（空间不足或存储被禁用）。请用「导出备份」保存本次草稿。');return false}
 finally{saving=false}
}
function showDialog(title,content){
 dialog.innerHTML='<header class="dialog-head"><h2>'+esc(title)+'</h2>'+button('关闭','close','close')+'</header><div class="dialog-body">'+content+'</div>';
 dialog.showModal();
}
function editRun(id=''){
 if(!available)return toast('请等待数据加载后再编辑。');
 const prev=state.runs.find(r=>r.id===id);
 const r=prev??{status:'待确认',co2Unit:'g CO₂/kg 干原料',hydrogenUnit:'mol H₂/kg 干原料',gasBasis:'干基 mol%'};
 const f=(k,l,t='text',opts=[])=>field(k,l,r[k],t,{options:opts,required:k==='name'||k==='version',wide:t==='textarea'});
 showDialog(prev?'查看 / 编辑模拟记录':'新增模拟记录','<form data-form="run" data-id="'+esc(id)+'"><div class="field-grid">'+runSpecs.slice(0,6).map(x=>f(...x)).join('')+'</div><h3 class="subhead">工况输入</h3><div class="field-grid">'+inputGrid(inputs,r)+f(...runSpecs[6])+'</div><h3 class="subhead">结果及口径</h3><div class="field-grid">'+inputGrid(outputs,r)+f(...runSpecs[7])+f(...runSpecs[8])+components.map((c,i)=>field('gas'+i,c+'（mol%）',r['gas'+i],'number')).join('')+runSpecs.slice(9).map(x=>f(...x)).join('')+'</div><div class="form-actions">'+(prev?button('用作新版本','duplicate-run','plus')+button('删除记录','remove-run','','danger'):'')+'<button type="submit" class="btn primary">'+icon('save')+'保存记录</button></div></form>');
}
function editModel(key,index){
 if(!available)return toast('请等待数据加载后再编辑。');
 const spec=modelLists[key],r=state.model[key][index]??{};
 const fields=spec.fields.map(([k,l,t='text',opts=[]],i)=>field(k,l,r[k]??opts[0],t,{options:opts,required:i===0,wide:t==='textarea'})).join('');
 showDialog((index===-1?'添加':'编辑')+spec.title,'<form data-form="model-list" data-key="'+key+'" data-index="'+index+'"><div class="field-grid">'+fields+'</div><div class="form-actions">'+(index>=0?button('删除条目','remove-model','','danger'):'')+'<button type="submit" class="btn primary">'+icon('save')+'保存条目</button></div></form>');
}
function saveFile(content,name,type){
 const link=document.createElement('a');
 link.href=URL.createObjectURL(new Blob([content],{type}));
 link.download=name;
 link.click();
 setTimeout(()=>URL.revokeObjectURL(link.href),2000);
}
function validState(s){
 const str=x=>typeof x==='string';
 const isRecord=(x,keys)=>x&&keys.every(k=>str(x[k]));
 const records=(x,keys)=>Array.isArray(x)&&x.every(r=>isRecord(r,keys));
 return s?.schema===1&&(s.updated===''||str(s.updated)&&Number.isFinite(Date.parse(s.updated)))&&
  isRecord(s.material,['sample','pretreatment','notes'])&&records(s.material.rows,['category','name','value','unit','basis','source'])&&
  isRecord(s.model,settings.filter(x=>x[0]!=='flowNodes').map(x=>x[0]))&&Array.isArray(s.model.flowNodes)&&s.model.flowNodes.every(str)&&
  Object.entries(modelLists).every(([k,spec])=>records(s.model[k],spec.fields.map(v=>v[0])))&&
  (!s.model.image||isRecord(s.model.image,['name','data']))&&
  records(s.runs,['id',...runSpecs.map(x=>x[0]),...inputs.map(x=>x[0]),...outputs.map(x=>x[0]),...components.map((_,i)=>'gas'+i)])&&new Set(s.runs.map(r=>r.id)).size===s.runs.length&&
  records(s.tasks,['status','notes'])&&s.tasks.length===stages.length&&Array.isArray(s.report)&&s.report.length===outline.length&&s.report.every(str);
}
function draftMaterial(action,index){
 const form=$('form[data-form="material"]');
 const d=readMaterial(form);
 if(action==='add-material')d.rows.push({category:'灰分组分',name:'',value:'',unit:'wt%',basis:'',source:''});
 else d.rows.splice(index,1);
 const old=state.material;
 state.material=d;
 render();
 state.material=old;
 if(action==='add-material')main.querySelectorAll('input[name$="-name"]').item(d.rows.length-1)?.focus();
 toast('已更新表单。点击「保存修改」提交。');
}
document.addEventListener('click',async ev=>{
 const target=ev.target.closest('[data-action]'); if(!target)return;
 const {action,id,key,index}=target.dataset;
 switch(action){
  case 'export':{
   if(!available&&!failedDraft)return toast('研究数据尚未加载。');
   const backup=failedDraft??state;
   saveFile(JSON.stringify(backup,null,2),'oiltea-scwg-workspace.json','application/json');
   if(failedDraft)toast('已导出尚未同步的草稿。');
   break;
  }
  case 'export-outline':saveFile('# 油茶壳超临界水气化制氢 · 汇报提纲\n\n'+outline.map((l,i)=>'## '+(i+1)+'. '+l+'\n\n'+(state.report[i]||'待确认')).join('\n\n'),'oiltea-scwg-outline.md','text/markdown;charset=utf-8');break;
  case 'new-run':editRun();break;
  case 'edit-run':editRun(id);break;
  case 'close':dialog.close();break;
  case 'add-material':case 'remove-material':draftMaterial(action,Number(index));break;
  case 'model-edit':editModel(key,index===undefined?-1:Number(index));break;
  case 'remove-image':{
   if(!confirm('移除当前流程图附件？'))break;
   const next=structuredClone(state);next.model.image=null;await persist(next);break;
  }
  case 'remove-run':case 'remove-model':{
   if(!confirm('删除当前记录？'))break;
   const form=$('form',dialog),next=structuredClone(state);
   if(action==='remove-run') next.runs=next.runs.filter(x=>x.id!==form.dataset.id);
   else next.model[form.dataset.key].splice(Number(form.dataset.index),1);
   if(await persist(next,'记录已删除'))dialog.close();
   break;
  }
  case 'duplicate-run':{
   const form=$('form',dialog);
   form.dataset.id='';
   form.elements.version.value='';
   form.elements.date.value='';
   form.elements.status.value='待确认';
   form.elements.co2Unit.value='g CO₂/kg 干原料'===form.elements.co2Unit.value?form.elements.co2Unit.value:'其他 / 待确认';
   for(const [key] of outputs)form.elements[key].value='';
   for(const [i] of components.entries())form.elements['gas'+i].value='';
   for(const key of ['anomaly','open','next'])form.elements[key].value='';
   for(const actionName of ['duplicate-run','remove-run'])$('[data-action="'+actionName+'"]',dialog).remove();
   $('h2',dialog).textContent='从已有工况创建新版本';
   form.elements.version.focus();
   break;
  }
  case 'reload':await loadWorkspace();break;
  case 'import':if(available)$('#import-input').click();else toast('请先连接工作台。');break;
 }
});
document.addEventListener('submit',async ev=>{
 const form=ev.target, kind=form.dataset.form;
 if(!kind)return;
 ev.preventDefault();
 if(!available||saving)return;
 const data=capturedForm(form),next=structuredClone(state);
 if(kind==='material'){
   next.material=readMaterial(form);
   if(next.material.rows.some(r=>!r.name.trim()))return toast('请为每条原料数据填写项目名称。');
 }
 if(kind==='model') Object.assign(next.model,data,{flowNodes:data.flowNodes.split('\n').map(s=>s.trim()).filter(Boolean)});
 if(kind==='tasks')next.tasks=stages.map((_,i)=>({status:data['status'+i],notes:data['note'+i]}));
 if(kind==='report')next.report=outline.map((_,i)=>data['r'+i]);
 if(kind==='run'){
   data.name=data.name.trim();data.version=data.version.trim();
   if(!data.name||!data.version)return toast('请填写情景名称和模拟版本。');
   const index=next.runs.findIndex(r=>r.id===form.dataset.id);
   const row={...data,id:form.dataset.id||crypto.randomUUID()};
   if(index>=0)next.runs[index]=row;
   else next.runs.push(row);
   if(await persist(next,'模拟记录已保存')){
      if(index<0)selected.add(row.id);
      dialog.close();
      render();
   }
   return;
 }
 if(kind==='model-list'){
   const key=form.dataset.key,idx=Number(form.dataset.index);
   const primary=modelLists[key].fields[0][0];
   data[primary]=data[primary].trim();
   if(!data[primary])return toast('请填写条目名称。');
   if(key==='components'&&(/[,，、+\s]/.test(data.id)||next.model.components.some((x,i)=>i!==idx&&x.id===data.id)))return toast('Aspen ID 需唯一，不含加号、空格或逗号。');
   if(idx>=0)next.model[key][idx]=data;
   else next.model[key].push(data);
   if(await persist(next,'模型条目已保存'))dialog.close();
   return;
 }
 await persist(next);
});
document.addEventListener('change',async ev=>{
 const target=ev.target;
 if(target.matches('[data-pick]')){
  if(target.checked)selected.add(target.dataset.pick);else selected.delete(target.dataset.pick);
  if(page==='compare'){const id=target.dataset.pick;render();[...main.querySelectorAll('[data-pick]')].find(x=>x.dataset.pick===id)?.focus()}
 }
 const choice=target.dataset.choice;
 if(choice){
  if(choice==='axis')axis=target.value;
  if(choice==='metric')metric=target.value;
  if(choice==='base')baseId=target.value;
  render();
  $('[data-choice="'+choice+'"]')?.focus();
 }
 if(target.id==='flow-image'&&target.files[0]){
   const file=target.files[0];
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000){target.value='';return toast('请上传 2 MB 以内的 PNG、JPG 或 WebP。')}
   const reader=new FileReader();
   reader.onload=async()=>{const next=structuredClone(state);next.model.image={name:file.name,data:reader.result};await persist(next,'流程图已保存')};
   reader.onerror=()=>toast('流程图读取失败。');
   reader.readAsDataURL(file);
 }
 if(target.id==='import-input'&&target.files[0]){
   const file=target.files[0];
   target.value='';
   try{
     if(file.size>10_000_000)throw new Error('备份文件超过 10 MB');
     const restored=JSON.parse(await file.text());
     if(!validState(restored))throw new Error('备份格式无效');
     if(confirm('用备份替换当前工作台数据？可以先取消并导出当前备份。')&&await persist(restored,'备份已恢复')){
        selected.clear();baseId='';render();
     }
   }catch(e){toast(e.message)}
 }
});
$('#menu').addEventListener('click',()=>{$('#menu').setAttribute('aria-expanded',String($('#sidebar').classList.toggle('open')))});
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)});
window.addEventListener('hashchange',route);
route();
loadWorkspace();
