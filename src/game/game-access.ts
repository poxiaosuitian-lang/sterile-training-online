import { Prisma } from '@prisma/client';

export const defaultGameAccess = {locked:false, title:'维护公告', message:'游戏维护中，请稍后再来。'};

export function gameAccess(value:Prisma.JsonValue | undefined) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    locked:config.locked === true,
    title:typeof config.title === 'string' && config.title.trim() ? config.title : defaultGameAccess.title,
    message:typeof config.message === 'string' && config.message.trim() ? config.message : defaultGameAccess.message,
  };
}
