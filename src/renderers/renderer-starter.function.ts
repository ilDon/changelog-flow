import { MdMaker } from 'changelog-flow/renderers/mark-down/md-maker.class';

export function rendererStarter(type: 'md'): void {
  new MdMaker().make();
}
