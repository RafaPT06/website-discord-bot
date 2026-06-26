import { isSmallPaginationScreen } from './utils.js';

export function getPaginationPages(currentPage, totalPages) {
  const maxNumericButtons = isSmallPaginationScreen() ? 4 : 7;

  if (totalPages <= maxNumericButtons + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  const siblingCount = isSmallPaginationScreen() ? 0 : 1;
  const start = Math.max(2, currentPage - siblingCount);
  const end = Math.min(totalPages - 1, currentPage + siblingCount);

  if (start > 2) pages.push('jump');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('jump');
  pages.push(totalPages);

  return pages;
}
