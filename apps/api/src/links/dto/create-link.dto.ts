import { IsIn } from 'class-validator';
import { CHANNELS, Channel } from '../../entities/channel';

export class CreateLinkDto {
  @IsIn(CHANNELS)
  channel!: Channel;
}
