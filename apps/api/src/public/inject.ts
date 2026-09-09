export function buildInjectedHtml(html: string, opts: { submitUrl: string; visitToken: string }): string {
  const script = `<script>(function(){var SUBMIT_URL=${JSON.stringify(opts.submitUrl)};var VISIT_TOKEN=${JSON.stringify(opts.visitToken)};
function collect(form){var fd=new FormData(form);var out={};fd.forEach(function(v,k){if(typeof v!=='string')return;if(k in out){out[k]=[].concat(out[k],v)}else{out[k]=v}});return out;}
function show(form,cls,msg){var p=document.createElement('p');p.setAttribute('data-lead-'+cls,'');p.textContent=msg;return p;}
document.addEventListener('submit',function(ev){var form=ev.target;if(!(form instanceof HTMLFormElement))return;ev.preventDefault();ev.stopImmediatePropagation();
var btns=form.querySelectorAll('button,input[type=submit]');btns.forEach(function(b){b.disabled=true});
var old=form.querySelector('[data-lead-error]');if(old)old.remove();
fetch(SUBMIT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitToken:VISIT_TOKEN,fields:collect(form)})})
.then(function(r){return r.json().then(function(b){return {ok:r.status===201,body:b}})})
.then(function(res){if(res.ok){form.replaceWith(show(form,'success',res.body.message||'신청이 완료되었습니다.'))}else{form.prepend(show(form,'error',Array.isArray(res.body.message)?res.body.message.join(', '):(res.body.message||'제출에 실패했습니다.')));btns.forEach(function(b){b.disabled=false})}})
.catch(function(){form.prepend(show(form,'error','네트워크 오류가 발생했습니다.'));btns.forEach(function(b){b.disabled=false})});},true);
})();</script>`;
  const idx = html.search(/<\/body>/i);
  return idx === -1 ? html + script : html.slice(0, idx) + script + html.slice(idx);
}
