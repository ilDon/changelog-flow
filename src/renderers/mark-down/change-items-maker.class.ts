import { ChangeItems } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';

export class ChangeItemsMaker {
  private rendered = '';

  constructor(
    private scope: ChangeItems['type'],
    private changeItems: Array<ChangeItems>
  ) { }

  public make(): string {
    this.addTitle();
    this.handleItems();
    return this.rendered;
  }

  private addTitle(): void {
    this.rendered += `### ${this.scope.charAt(0).toUpperCase() + this.scope.slice(1)}\n`;
  }

  private handleItems(): void {
    this.changeItems.forEach(item => this.addRenderedItem(item));
    this.rendered += '\n';
  }

  private addRenderedItem(item: ChangeItems): void {
    this.rendered += `- ${item.value}`;
    if (this.rendered.endsWith(';') || this.rendered.endsWith(','))
      this.rendered.substring(0, this.rendered.length - 1);
    if (!this.rendered.endsWith('.'))
      this.rendered += '.';
    this.rendered += '\n';
  }

}
