import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSubmissionDto } from './create-submission.dto';

describe('CreateSubmissionDto', () => {
  it('visitToken이 uuid 형식이 아니면 검증 오류가 발생한다', async () => {
    const dto = plainToInstance(CreateSubmissionDto, { visitToken: 'not-a-uuid', fields: { name: 'a' } });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'visitToken')).toBe(true);
  });

  it('visitToken이 uuid 형식이면 통과한다', async () => {
    const dto = plainToInstance(CreateSubmissionDto, {
      visitToken: '11111111-1111-4111-8111-111111111111',
      fields: { name: 'a' },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
