// "Check yourself" questions. Authored as plain HTML:
//   <div class="q" data-answer="b">
//     <p class="q__stem">…</p>
//     <ol class="q__opts"><li data-k="a">…</li><li data-k="b">…</li></ol>
//     <div class="q__why">…</div>
//   </div>
// Without JavaScript the options and the explanation simply read as text.

for (const q of document.querySelectorAll(".q[data-answer]")) {
  const answer = q.dataset.answer;
  const why = q.querySelector(".q__why");
  const opts = [...q.querySelectorAll(".q__opts > li")];
  if (why) why.hidden = true;

  const buttons = opts.map((li) => {
    const k = li.dataset.k;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "q__opt";
    b.dataset.k = k;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="k">${k.toUpperCase()}</span><span>${li.innerHTML}</span>`;
    li.replaceChildren(b);
    return b;
  });

  for (const b of buttons) {
    b.addEventListener("click", () => {
      if (q.classList.contains("is-answered")) return;
      q.classList.add("is-answered");
      const right = b.dataset.k === answer;
      b.setAttribute("aria-pressed", "true");
      for (const o of buttons) {
        if (o.dataset.k === answer) o.classList.add("is-right");
        else if (o === b) o.classList.add("is-wrong");
        o.setAttribute("aria-disabled", "true");
      }
      if (why) {
        const v = document.createElement("span");
        v.className = "q__verdict " + (right ? "ok" : "no");
        v.textContent = right ? "Right." : `Not quite: the answer is ${answer.toUpperCase()}.`;
        why.prepend(v);
        why.hidden = false;
        why.setAttribute("role", "status");
      }
    });
  }
}
