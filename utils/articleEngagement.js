export const normalizeArticleSlug = (value) =>
  `${value || ""}`.trim().toLowerCase();

export const serializeArticleComments = (comments = []) =>
  [...comments]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((comment) => ({
      id: `${comment._id}`,
      name: comment.name,
      message: comment.message,
      createdAt: comment.createdAt,
    }));
