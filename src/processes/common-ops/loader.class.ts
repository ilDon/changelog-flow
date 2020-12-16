import { DIRS } from 'changelog-flow/libs/paths/dirs.constant';
import { ChangeLogger } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';
import { readJSONSync } from 'fs-extra';

export class Loader {

  protected changeLogger: ChangeLogger;

  protected loadChangelogger(): void {
    this.changeLogger = readJSONSync(DIRS.pathToChangelogJson);
  }

}
