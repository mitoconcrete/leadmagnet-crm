import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithOperator } from './auth.guard';

export const CurrentOperator = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestWithOperator>();
  return req.operator;
});
