export class ResponseDto<T> {
  data: T;
  message?: string;

  constructor(data: T, message?: string) {
    this.data = data;
    if (message) this.message = message;
  }
}

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
