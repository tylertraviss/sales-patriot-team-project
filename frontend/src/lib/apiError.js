export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}
