import { errorHandler } from '@bohr/changelogger/libs/errors//error-handler.function';
import { fatalErrors, infoErrors } from '@bohr/changelogger/libs/errors//errors.enum';
import { CHANGE_VALUE } from '@bohr/changelogger/questions/change-adding/change-value.constant';
import { LOG_TYPES } from '@bohr/changelogger/questions/change-adding/log-type.constant';
import { NEXT_STEP } from '@bohr/changelogger/questions/change-adding/next-step-constant';
import { questionMaker } from '@bohr/changelogger/questions/question-maker.function';
import { Answers } from 'inquirer';

export class StepsHandler {

  private newChanges: Array<Answers> = [];

  constructor(
    private tempLogs: number = 0
  ) { }

  public async start(): Promise<Array<Answers>> {
    await this.startQuestions();
    this.finish();
    return this.newChanges;
  }

  private async startQuestions(): Promise<void> {
    if (this.tempLogs === 0)
      await this.newQuestion();
    else
      await this.enquireNextStep();
  }

  private async newQuestion(): Promise<void> {
    const answers = await questionMaker([LOG_TYPES, CHANGE_VALUE]);
    this.pushNewAnswers(answers);
    await this.enquireNextStep();
  }

  private pushNewAnswers(answers: Answers): void {
    this.newChanges.push(answers);
  }

  private async enquireNextStep(): Promise<void> {
    const answer = await questionMaker([NEXT_STEP]);
    if (answer['next'] === 'add')
      await this.newQuestion();
  }

  private finish(): void {
    if (this.noMeaningfulData() && this.tempLogs === 0)
      errorHandler(fatalErrors.noLogsProvided);
    if (this.newChanges.length)
      this.cleanEmptyMessages();
  }

  private noMeaningfulData(): boolean {
    const arrMeaningless = this.newChanges.filter(change => change.value === '');
    return arrMeaningless.length === this.newChanges.length;
  }

  private cleanEmptyMessages(): void {
    const cleaned = this.newChanges.filter(change => change.value !== '');

    if (cleaned.length === this.newChanges.length)
      return;

    errorHandler(infoErrors.cleanedEmpty);
    this.newChanges = cleaned;
  }

}
