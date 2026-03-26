/**
 * <decision-card> — Renders a single decision twin inline
 * Properties set via JS: .decision = { frame, options, task_ref, ... }
 * Dispatches 'decision-resolve' CustomEvent with { decisionId, choice, reasoning }
 */

class DecisionCard extends HTMLElement {
  set decision(dec) {
    this._dec = dec;
    this._render();
  }

  _render() {
    const d = this._dec;
    if (!d) return;

    const options = (typeof d.options === 'string' ? JSON.parse(d.options) : d.options) || [];

    this.innerHTML = `
      <div class="dc" style="border:1px solid var(--ms-border,#e2e8f0);border-radius:8px;padding:12px;margin:8px 0;background:var(--ms-bg,#fff);">
        <div style="font-size:11px;color:var(--ms-muted,#94a3b8);margin-bottom:4px;">
          Decision${d.task_ref ? ` · ${d.task_ref}` : ''}
        </div>
        <div style="font-size:13px;color:var(--ms-text,#1e293b);margin-bottom:8px;line-height:1.4;">
          ${this._escapeHtml(d.frame)}
        </div>
        <div class="dc-options" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
          ${options.map(o => `
            <button class="dc-opt" data-choice="${this._escapeHtml(o.id)}" style="text-align:left;padding:8px 12px;border:1px solid var(--ms-border,#e2e8f0);border-radius:6px;background:var(--ms-surface,#f8fafc);cursor:pointer;font-size:12px;">
              <strong>${this._escapeHtml(o.id)}.</strong> ${this._escapeHtml(o.label)}
              ${o.evaluation ? `<div style="font-size:11px;color:var(--ms-muted,#94a3b8);margin-top:2px;">${this._escapeHtml(o.evaluation)}</div>` : ''}
            </button>
          `).join('')}
        </div>
        <input class="dc-reasoning" type="text" placeholder="Reasoning (optional)" style="width:100%;padding:6px 8px;border:1px solid var(--ms-border,#e2e8f0);border-radius:4px;font-size:11px;box-sizing:border-box;display:none;" />
      </div>`;

    // Option click handlers
    this.querySelectorAll('.dc-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.choice;
        const reasoning = this.querySelector('.dc-reasoning')?.value || '';
        this.dispatchEvent(new CustomEvent('decision-resolve', {
          bubbles: true,
          detail: { decisionId: d.id, choice, reasoning }
        }));
        // Visual feedback
        btn.style.background = '#dcfce7';
        btn.style.borderColor = '#22c55e';
        this.querySelectorAll('.dc-opt').forEach(b => { if (b !== btn) b.style.opacity = '0.4'; });
      });
    });
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

customElements.define('decision-card', DecisionCard);
