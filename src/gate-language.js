export const GATE_LINES = Object.freeze({
  whale: { ancient: 'ἄκουε, ὦ ξένε. κῆτος, ἐκ τοῦ βυθοῦ ἀνάδυθι.', meaning: '听，旅人。深海巨兽，自海渊升起。' },
  light: { ancient: 'ὦ φῶς παλαιόν, ἐκ τοῦ σκότους ἀνάτειλον. τὴν ὁδὸν ἡμῖν δεῖξον.', meaning: '古老的光，自黑暗中升起，为我们指明道路。' },
  memory: { ancient: 'ἡ τῆς θαλάσσης μνήμη οὐδέποτε ἀπόλλυται. τὰ καθεύδοντα ἐγειρέσθω.', meaning: '海洋的记忆从未消逝。愿沉睡的一切醒来。' },
  gate: { ancient: 'χαῖρε, Ποσείδαον γαιήοχε, κυανοχαῖτα. πύλαι τοῦ πόντου, ἀνοίγεσθε.', meaning: '致意，环抱大地、深色鬈发的波塞冬。海之门，开启。' },
  life: { ancient: 'ὦ ζωή, εἰς τὴν θάλασσαν ἐπάνελθε. πνεύματα παλαιά, ἐγείρεσθε.', meaning: '生命，重返海洋。古老的灵魂，醒来。' },
  stars: { ancient: 'ὦ ἄστρα, ὑπὲρ τῆς θαλάσσης λάμπετε. ὦ νὺξ παλαιά, ἄκουσον ἡμῶν.', meaning: '群星，照亮海洋。古老的夜，请听见我们。' },
  answer: { ancient: 'ἄκουε, ὦ ξένε. ὁ πόντος τῆς σῆς φωνῆς ἀκούει. ἐκ τοῦ βυθοῦ ἀποκρινόμεθα.', meaning: '听，旅人。海洋听见了你的声音。我们从深渊回应。' },
});

export function gateInvocation(value) {
  const text = String(value || '').slice(0, 160);
  const id = /鲸|whale|cetus/i.test(text) ? 'whale' : /星|star/i.test(text) ? 'stars' : /光|太阳|light|sun/i.test(text) ? 'light' : /记忆|回忆|故人|过去|memory|remember/i.test(text) ? 'memory' : /人鱼|海豚|海龟|鲨|生命|灵魂|life|mermaid|dolphin|turtle|shark/i.test(text) ? 'life' : /门|守护|gate|guardian/i.test(text) ? 'gate' : 'answer';
  return { id, ...GATE_LINES[id], language: '古希腊语 · 仿古短句与合成近似发音', file: `audio/gate/grc-${id}.mp3` };
}
