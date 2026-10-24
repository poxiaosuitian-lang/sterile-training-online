// A single Web Audio context is resumed synchronously by a real user gesture.
// Once unlocked, delayed feedback and background music can use decoded buffers.
(() => {
  let ctx, music, musicGain, wantsMusic = false, musicVolume = .35, effectsVolume = .65;
  const buffers = new Map(), pending = new Map(), effects = new Set();
  function context() {
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      ctx = new Audio();
    }
    return ctx;
  }
  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (pending.has(name)) return pending.get(name);
    const task = fetch(new URL(`assets/assets/audio/${name}.wav`, document.baseURI))
      .then(r => { if (!r.ok) throw Error('Audio unavailable'); return r.arrayBuffer(); })
      .then(b => context().decodeAudioData(b))
      .then(b => { buffers.set(name, b); pending.delete(name); return b; })
      .catch(() => { pending.delete(name); return null; });
    pending.set(name, task); return task;
  }
  function stopMusic() { if (music) { music.stop(); music = null; } }
  function updateMusic() {
    if (!ctx || ctx.state !== 'running' || !wantsMusic || document.hidden) { stopMusic(); return; }
    if (music) { musicGain.gain.value = musicVolume; return; }
    load('ark_theme').then(buffer => {
      if (!buffer || music || !wantsMusic || ctx.state !== 'running' || document.hidden) return;
      music = ctx.createBufferSource(); music.buffer = buffer; music.loop = true;
      musicGain = ctx.createGain(); musicGain.gain.value = musicVolume;
      music.connect(musicGain).connect(ctx.destination); music.start();
    });
  }
  function unlock() {
    const c = context(); if (!c) return;
    c.resume().then(updateMusic).catch(() => {});
  }
  document.addEventListener('pointerdown', unlock, {passive:true});
  document.addEventListener('touchend', unlock, {passive:true});
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopMusic(); for (const s of effects) s.stop(); effects.clear(); }
    else updateMusic();
  });
  window.arkAudio = (command, value, name) => {
    if (!context()) return;
    switch(command) {
      case 'initialize': for (const n of ['ark_theme','tap','merge','incorrect','complete']) load(n); break;
      case 'music': wantsMusic=true; musicVolume=value; updateMusic(); break;
      case 'pause': wantsMusic=false; stopMusic(); break;
      case 'volume': effectsVolume=value; break;
      case 'effect': {
        if (ctx.state !== 'running' || document.hidden || effectsVolume <= 0) break;
        const buffer=buffers.get(name); if (!buffer) { load(name); break; }
        const source=ctx.createBufferSource(), gain=ctx.createGain();
        source.buffer=buffer; gain.gain.value=effectsVolume;
        source.connect(gain).connect(ctx.destination); effects.add(source);
        source.onended=()=>effects.delete(source); source.start(); break;
      }
      case 'stop': for (const s of effects) s.stop(); effects.clear(); break;
      case 'close': wantsMusic=false; stopMusic(); for (const s of effects) s.stop(); effects.clear(); break;
    }
  };
})();
