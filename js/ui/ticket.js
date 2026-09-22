// Order ticket (stock + options chain).
(function (B) {
  'use strict';
  const $ = B.el;

  B.Ticket = {
    tab: 'stock',

    init() {
      $('tk-type').addEventListener('change', () => {
        const t = $('tk-type').value;
        $('tk-price').disabled = t === 'market';
        if (t !== 'market' && B.UI.g) $('tk-price').value = B.UI.g.market.bySym[B.UI.sel].last.toFixed(2);
      });
      document.querySelectorAll('.sizes button').forEach((b) => b.addEventListener('click', () => this.sizePct(+b.dataset.pct)));
      $('tk-buy').addEventListener('click', () => this.send(1));
      $('tk-sell').addEventListener('click', () => this.send(-1));
      ['tk-qty', 'tk-price', 'tk-sl', 'tk-tp', 'op-n'].forEach((id) => {
        const input = $(id);
        if (input) input.addEventListener('focus', () => input.select());
      });
      $('tk-close').addEventListener('click', () => B.UI.g && B.UI.g.closePos(B.UI.sel));
      $('tk-flat').addEventListener('click', () => B.UI.g && B.UI.g.flatten());
      document.querySelectorAll('.tk-tabs button').forEach((b) => b.addEventListener('click', () => {
        this.tab = b.dataset.tk;
        document.querySelectorAll('.tk-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        $('tk-stock').hidden = this.tab !== 'stock';
        $('tk-options').hidden = this.tab !== 'options';
        this.renderChain(true);
      }));
      $('op-chain').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-k]');
        if (!btn || !B.UI.g) return;
        const n = Math.max(1, Math.trunc(+$('op-n').value || 1));
        B.UI.g.buyOption(B.UI.sel, btn.dataset.type, +btn.dataset.k, +$('op-exp').value, n);
      });
      $('op-exp').addEventListener('change', () => this.renderChain(true));
    },

    qty() { return Math.max(0, Math.trunc(+$('tk-qty').value || 0)); },

    sizePct(pct, side) {
      const g = B.UI.g;
      if (!g) return;
      const mx = g.broker.maxQty(B.UI.sel, side || 1);
      $('tk-qty').value = Math.max(1, Math.floor(mx * pct));
      B.SFX.click();
    },

    send(side) {
      const g = B.UI.g;
      if (!g) return;
      B.SFX.unlock();
      const type = $('tk-type').value;
      const price = +$('tk-price').value;
      const sl = +$('tk-sl').value || 0;
      const tp = +$('tk-tp').value || 0;
      g.trade(B.UI.sel, side * this.qty(), { type, price, sl, tp });
    },

    render(g) {
      const sym = B.UI.sel;
      const tk = g.market.bySym[sym];
      const q = this.qty();
      const mxB = g.broker.maxQty(sym, 1), mxS = g.broker.maxQty(sym, -1);
      $('tk-max').textContent = `max buy ${B.fmt.qty(mxB)} · max sell ${B.fmt.qty(mxS)}`;
      $('tk-est').textContent = q ? `≈ ${B.fmt.compact(q * tk.last)} notional` : '';
      const r = g.broker.rules;
      const bits = [`LEV ${r.maxLev}x day / ${r.overnightLev}x o/n`];
      if (r.shortBan.length) bits.push('<span class="warn">SHORT BAN: financials</span>');
      $('tk-rules').innerHTML = bits.join(' · ');
      if (this.tab === 'options') this.renderChain();
    },

    renderChain(force) {
      const g = B.UI.g;
      if (!g || this.tab !== 'options') return;
      const now = performance.now();
      if (!force && now - (this.lastChain || 0) < 350) return;
      this.lastChain = now;
      const sym = B.UI.sel;
      const m = g.market;
      const sel = $('op-exp');
      const exps = B.Options.expiries(m.day, g.mode.lastDay);
      const key = exps.map((e) => e.day).join(',') + sym;
      if (sel.dataset.key !== key) {
        const prev = sel.value;
        sel.innerHTML = exps.map((e) => `<option value="${e.day}">${e.label}${e.day === m.day ? ' (0DTE!)' : ''}</option>`).join('');
        if (exps.some((e) => String(e.day) === prev)) sel.value = prev;
        sel.dataset.key = key;
      }
      const exp = +sel.value;
      const S = m.bySym[sym].last;
      const ks = B.Options.strikes(S);
      $('op-iv').textContent = `IV ${(B.Options.iv(m, sym) * 100).toFixed(0)}%`;
      // Rebuild the table only when the strikes change, so buttons are never swapped out mid-click.
      const tkey = sym + '|' + exp + '|' + ks.join(',');
      const chain = $('op-chain');
      if (chain.dataset.key !== tkey) {
        chain.dataset.key = tkey;
        const rows = ks.map((k, i) => `<tr>
            <td data-c="${i}"></td>
            <td data-cb="${i}"><button class="c" data-type="C" data-k="${k}">Buy Call</button></td>
            <td class="k">${B.fmt.price(k)}</td>
            <td data-pb="${i}"><button class="p" data-type="P" data-k="${k}">Buy Put</button></td>
            <td data-p="${i}"></td>
          </tr>`).join('');
        chain.innerHTML = `<table><thead><tr><th>Call bid / ask</th><th></th><th>Strike</th><th></th><th>Put bid / ask</th></tr></thead><tbody>${rows}</tbody></table>`;
      }
      ks.forEach((k, i) => {
        const c = B.Options.quote(m, sym, 'C', k, exp);
        const p = B.Options.quote(m, sym, 'P', k, exp);
        const cc = chain.querySelector(`[data-c="${i}"]`), pc = chain.querySelector(`[data-p="${i}"]`);
        cc.textContent = `${B.fmt.price(c.bid)} / ${B.fmt.price(c.ask)}`;
        pc.textContent = `${B.fmt.price(p.bid)} / ${B.fmt.price(p.ask)}`;
        cc.className = S > k ? 'itm' : '';
        chain.querySelector(`[data-cb="${i}"]`).className = S > k ? 'itm' : '';
        pc.className = S < k ? 'itm' : '';
        chain.querySelector(`[data-pb="${i}"]`).className = S < k ? 'itm' : '';
      });
    }
  };
})(window.BTB);
