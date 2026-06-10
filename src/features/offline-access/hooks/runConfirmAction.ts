import { toastError, toastSuccess } from '@novasamatech/tr-ui';
import { type Observable } from 'rxjs';

type Options = {
  successTitle: string;
  errorTitle: string;
  onSuccess: VoidFunction;
};

// Toasts the outcome of a `useAction(...).run(...)` observable: success + an
// `onSuccess` callback on a truthy result, error toast on a falsy result or a
// thrown error.
export function runConfirmAction<T>(action$: Observable<T | null>, options: Options): void {
  action$.subscribe({
    next: result => {
      if (!result) {
        toastError({ title: options.errorTitle });
        return;
      }
      toastSuccess({ title: options.successTitle });
      options.onSuccess();
    },
    error: () => toastError({ title: options.errorTitle }),
  });
}
