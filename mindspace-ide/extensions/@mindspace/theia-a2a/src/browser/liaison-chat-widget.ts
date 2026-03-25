/**
 * Liaison Chat Widget — Theia panel for human-in-the-loop A2A interaction
 * Shows events as cards, approval cards with approve/reject, @mention messages.
 */
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';

@injectable()
export class LiaisonChatWidget extends BaseWidget {
  static readonly ID = 'mindspace-liaison-chat';
  static readonly LABEL = 'Liaison Chat';

  private messages: { sender: string; text: string; timestamp: Date }[] = [];
  private approvalMode = 'semi';

  @postConstruct()
  init(): void {
    this.id = LiaisonChatWidget.ID;
    this.title.label = LiaisonChatWidget.LABEL;
    this.title.closable = true;
    this.title.caption = 'Human-in-the-loop A2A chat';
    this.node.style.cssText = 'display:flex;flex-direction:column;height:100%;background:var(--theia-editor-background);';
    this.renderChat();
  }

  private renderChat(): void {
    this.node.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:8px;" class="lc-messages"></div>
      <div class="lc-cards" style="padding:0 8px;"></div>
      <div style="display:flex;border-top:1px solid var(--theia-panel-border);">
        <input type="text" class="lc-input" placeholder="Type message (@role to direct)..." style="flex:1;background:var(--theia-input-background);border:none;color:var(--theia-foreground);padding:6px 10px;outline:none;" />
        <button class="lc-send" style="background:var(--theia-button-background);border:none;color:var(--theia-button-foreground);padding:6px 12px;cursor:pointer;">Send</button>
      </div>
    `;
    this.node.querySelector('.lc-send')?.addEventListener('click', () => this.send());
    this.node.querySelector('.lc-input')?.addEventListener('keydown', (e: any) => { if (e.key === 'Enter') this.send(); });
  }

  addMessage(sender: string, text: string): void {
    this.messages.push({ sender, text, timestamp: new Date() });
    const el = this.node.querySelector('.lc-messages');
    if (!el) return;
    const div = document.createElement('div');
    div.style.cssText = `max-width:80%;padding:4px 8px;border-radius:6px;margin:2px 0;font-size:12px;align-self:${sender === 'user' ? 'flex-end' : 'flex-start'};background:${sender === 'user' ? 'var(--theia-button-background)' : 'var(--theia-input-background)'};`;
    div.textContent = text;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  showApprovalCard(data: any): void {
    const cards = this.node.querySelector('.lc-cards');
    if (!cards) return;
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--theia-input-background);border:1px solid var(--theia-panel-border);border-radius:6px;padding:10px;margin:6px 0;';
    card.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;">${data.title || data.task_slug}</div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="approve" style="padding:4px 12px;border:none;border-radius:3px;background:#50fa7b;color:#000;cursor:pointer;">Approve</button>
        <button class="reject" style="padding:4px 12px;border:none;border-radius:3px;background:#f38ba8;color:#000;cursor:pointer;">Reject</button>
      </div>`;
    card.querySelector('.approve')?.addEventListener('click', () => { this.addMessage('user', `Approved: ${data.task_slug}`); card.remove(); });
    card.querySelector('.reject')?.addEventListener('click', () => { this.addMessage('user', `Rejected: ${data.task_slug}`); card.remove(); });
    cards.appendChild(card);
  }

  private send(): void {
    const input = this.node.querySelector('.lc-input') as HTMLInputElement;
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';
    this.addMessage('user', text);
  }

  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
  }
}
