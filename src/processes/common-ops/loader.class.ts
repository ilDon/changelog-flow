import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { ChangeLogger } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';
import * as fs from 'fs-extra';

export class Loader {

  protected changeLogger: ChangeLogger;

  protected loadChangelogger(): void {
    this.changeLogger = fs.readJSONSync(DIRS.pathToChangelogJson);
  }

}
