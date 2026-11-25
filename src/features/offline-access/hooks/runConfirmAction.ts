import { type Observable } from 'rxjs';

import { toast } from '@/shared/components';

type Options = {
  successTitle: string;
  errorTitle: string;
  onSuccess?: VoidFunction;
};

// Toasts the outcome of a `useAction(...).run(...)` observable: success + an
// `onSuccess` callback on a truthy result, error toast on a falsy result or a
// thrown error.
export function runConfirmAction<T>(action$: Observable<T | null>, options: Options): void {
  action$.subscribe({
    next: result => {
      if (!result) {
        toast.error({ title: options.errorTitle });
        return;
      }
      toast.success({ title: options.successTitle });
      options.onSuccess?.();
    },
    error: () => toast.error({ title: options.errorTitle }),
  });
}
