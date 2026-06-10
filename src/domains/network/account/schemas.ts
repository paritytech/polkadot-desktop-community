import * as v from 'valibot';

import { hexString } from '@/shared/types';

export const accountId = v.pipe(hexString, v.brand('AccountId'));
