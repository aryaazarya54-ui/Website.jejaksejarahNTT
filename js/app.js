(() => {
  "use strict";
  const data = window.JEJAK_DATA;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const storage = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { toast("Penyimpanan lokal tidak tersedia di peramban ini."); } }
  };
  let session = null;
  let toastTimer = null;
  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  function renderTopics(filter="") {
    const grid = $("#topicGrid");
    const items = data.topics.filter(t => (t.title+" "+t.summary+" "+t.period).toLowerCase().includes(filter.toLowerCase()));
    grid.innerHTML = items.length ? items.map((t,i)=>`<button class="topic-card" data-topic="${escapeHtml(t.id)}"><span class="topic-number">TOPIK ${String(data.topics.indexOf(t)+1).padStart(2,"0")}</span><span class="topic-icon" aria-hidden="true">${t.icon}</span><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.period)}</span></button>`).join("") : `<p class="empty-state">Topik tidak ditemukan. Coba kata kunci lain.</p>`;
    $$(".topic-card",grid).forEach(b=>b.addEventListener("click",()=>showTopic(b.dataset.topic)));
  }
  function showTopic(id) {
    const t = data.topics.find(x=>x.id===id); if(!t) return;
    const detail = $("#timelineDetail");
    detail.innerHTML = `<span class="detail-kicker">MATERI • ${escapeHtml(t.period.toUpperCase())}</span><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.body)}</p><p class="detail-source"><strong>Sumber:</strong> ${escapeHtml(t.source)}</p>`;
    $("#timelineDetail").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto":"smooth",block:"center"});
  }
  function renderTimeline() {
    $("#timeline").innerHTML = data.timeline.map((t,i)=>`<button class="timepoint" data-time="${i}" aria-pressed="${i===0}"><span class="dot">${i+1}</span><strong>${escapeHtml(t.year)}</strong><span>${escapeHtml(t.title)}</span></button>`).join("");
    $$(".timepoint").forEach(b=>b.addEventListener("click",()=>{
      $$(".timepoint").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
      const t=data.timeline[Number(b.dataset.time)];
      $("#timelineDetail").innerHTML=`<span class="detail-kicker">${escapeHtml(t.year.toUpperCase())}</span><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.body)}</p>`;
    }));
  }
  function getScores(){return storage.get("jejakntt_scores",[]);}
  function renderScores(){
    const scores=getScores(); const el=$("#scoreBoard");
    if(!scores.length){el.innerHTML='<p class="empty-state">Belum ada skor. Selesaikan kuis untuk mengisi papan skor.</p>';return;}
    el.innerHTML=`<table class="score-table"><thead><tr><th>Waktu</th><th>Skor</th><th>Level akhir</th></tr></thead><tbody>${scores.slice(0,8).map(s=>`<tr><td>${escapeHtml(s.date)}</td><td><strong>${s.score}/100</strong></td><td>${escapeHtml(s.level)}</td></tr>`).join("")}</tbody></table>`;
  }
  function chooseQuestion() {
    const remaining=data.questions.filter(q=>!session.asked.includes(q.id));
    if(!remaining.length) return null;
    const level=session.level;
    const candidates=remaining.filter(q=>q.level===level);
    const pool=candidates.length?candidates:remaining;
    return pool[Math.floor(Math.random()*pool.length)];
  }
  function updateProgress(){
    const pct=Math.round(session.asked.length/session.total*100);
    $("#progressFill").style.width=pct+"%";$("#quizProgress").setAttribute("aria-valuenow",String(pct));
    $("#questionCounter").textContent=`Soal ${Math.min(session.asked.length+1,session.total)} dari ${session.total}`;
    $("#difficultyBadge").textContent=["","TINGKAT DASAR","TINGKAT MENENGAH","TINGKAT LANJUT"][session.level];
  }
  function startQuiz(){
    session={total:10,asked:[],correct:0,level:1,streak:0,wrongTopics:[],current:null,locked:false};
    nextQuestion();
  }
  function nextQuestion(){
    if(session.asked.length>=session.total){finishQuiz();return;}
    session.current=chooseQuestion();
    if(!session.current){finishQuiz();return;}
    session.asked.push(session.current.id);session.locked=false;
    updateProgress();
    const q=session.current;
    $("#quizContent").innerHTML=`<p class="eyebrow">PERTANYAAN ${session.asked.length.toString().padStart(2,"0")}</p><h3 class="question-title">${escapeHtml(q.q)}</h3><div class="answer-list">${q.options.map((o,i)=>`<button class="answer-option" data-answer="${i}"><span class="letter">${"ABCD"[i]}</span><span>${escapeHtml(o)}</span></button>`).join("")}</div><div id="answerFeedback" aria-live="polite"></div><div class="quiz-controls"><p id="adaptiveHint">Jawab dengan teliti. Pembahasan tersedia setelah memilih.</p><button class="button primary" id="nextQuestion" disabled>${session.asked.length===session.total?"Lihat hasil":"Soal berikutnya"} →</button></div>`;
    $$(".answer-option").forEach(b=>b.addEventListener("click",()=>answer(Number(b.dataset.answer))));
    $("#nextQuestion").addEventListener("click",nextQuestion);
  }
  function answer(index){
    if(session.locked)return;session.locked=true;
    const q=session.current, correct=index===q.answer;
    if(correct){session.correct++;session.streak++;if(session.streak>=2)session.level=Math.min(3,session.level+1);}
    else {session.streak=0;session.wrongTopics.push(q.topic);session.level=Math.max(1,session.level-1);}
    $$(".answer-option").forEach((b,i)=>{b.disabled=true;if(i===q.answer)b.classList.add("correct");if(i===index&&!correct)b.classList.add("wrong");});
    $("#answerFeedback").innerHTML=`<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Tepat!":"Belum tepat."}</strong> ${escapeHtml(q.explanation)}<br><small>Rujukan: ${escapeHtml(q.source)}</small></div>`;
    $("#adaptiveHint").textContent=correct?"Kamu menjawab benar. Jika konsisten, tingkat soal akan meningkat.":"Asisten menurunkan tingkat soal sementara agar kamu dapat menguatkan dasar materi.";
    $("#nextQuestion").disabled=false;
    $("#questionCounter").textContent=`Soal ${session.asked.length} dari ${session.total} • ${correct?"Benar":"Perlu dipelajari"}`;
    $("#progressFill").style.width=Math.round(session.asked.length/session.total*100)+"%";
    $("#quizProgress").setAttribute("aria-valuenow",String(Math.round(session.asked.length/session.total*100)));
    $("#nextQuestion").focus();
  }
  function finishQuiz(){
    const score=Math.round(session.correct/session.total*100);
    const level=["","Dasar","Menengah","Lanjut"][session.level];
    const date=new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
    const scores=getScores();scores.unshift({score,level,date,correct:session.correct,total:session.total,wrongTopics:session.wrongTopics});storage.set("jejakntt_scores",scores.slice(0,20));renderScores();
    $("#questionCounter").textContent="Sesi selesai";$("#difficultyBadge").textContent="HASIL KUIS";
    $("#progressFill").style.width="100%";$("#quizProgress").setAttribute("aria-valuenow","100");
    $("#quizContent").innerHTML=`<p class="eyebrow">HASIL BELAJARMU</p><div class="result-score">${score}<small> / 100</small></div><h3>${score>=80?"Hebat, pengetahuanmu kuat!":score>=60?"Bagus, terus tingkatkan!":"Ini awal yang baik."}</h3><p class="result-summary">Jawaban benar: ${session.correct} dari ${session.total}. Tingkat akhir: ${level}. ${score>=80?"Pertahankan kebiasaan memeriksa sumber.": "Buka kembali materi yang direkomendasikan lalu coba kuis lagi."}</p><div class="result-actions"><button class="button primary" id="retryQuiz">Ulangi kuis</button><a class="button secondary" href="#jelajah">Baca materi</a></div>`;
    $("#retryQuiz").addEventListener("click",startQuiz);
    $("#coachText").textContent=score>=80?"Hasilmu bagus. Coba jelaskan kembali satu peristiwa sejarah dengan menyebutkan sumbernya.":"Asisten akan membantu memilih topik yang perlu kamu pelajari kembali.";
    $("#coachResponse").hidden=true;
    session.lastWrong=[...session.wrongTopics];
    toast("Skor disimpan di perangkat ini.");
  }
  function coachAdvice(){
    const scores=getScores();const latest=scores[0];
    let advice;
    if(!latest) advice="Mulai dengan kuis singkat untuk mengetahui topik yang sudah kamu pahami. Setelah itu, gunakan materi dan rujukan untuk belajar.";
    else if(latest.score>=80) advice=`Skor terakhirmu ${latest.score}/100. Tantang diri dengan membaca sumber rujukan dan membuat ringkasan peristiwa menggunakan kata-katamu sendiri.`;
    else {
      const ids=(latest.wrongTopics||[]);const counts={};ids.forEach(id=>counts[id]=(counts[id]||0)+1);
      const id=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
      const topic=data.topics.find(t=>t.id===id);
      advice=topic?`Skor terakhirmu ${latest.score}/100. Prioritaskan materi “${topic.title}”. ${topic.summary} Setelah membaca, coba ulangi kuis dan perhatikan sumber yang dicantumkan.`:`Skor terakhirmu ${latest.score}/100. Mulai dari topik “Provinsi Sunda Kecil” dan “Terbentuknya Provinsi NTT”, lalu coba lagi.`;
    }
    $("#coachResponse").textContent=advice;$("#coachResponse").hidden=false;
  }
  $("#materiSearch").addEventListener("input",e=>renderTopics(e.target.value));
  $("#startQuiz").addEventListener("click",startQuiz);
  $("#showCoach").addEventListener("click",coachAdvice);
  $("#clearScores").addEventListener("click",()=>{if(confirm("Hapus semua riwayat skor yang tersimpan pada perangkat ini?")){storage.set("jejakntt_scores",[]);renderScores();toast("Riwayat skor dihapus.");}});
  $("#menuToggle").addEventListener("click",()=>{const nav=$("#mainNav");const open=nav.classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open));});
  $$("#mainNav a").forEach(a=>a.addEventListener("click",()=>{$("#mainNav").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");}));
  renderTopics();renderTimeline();renderScores();
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>toast("Service worker belum dapat diaktifkan.")));
  }
})();