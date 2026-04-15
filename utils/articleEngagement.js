export const normalizeArticleSlug = (value) =>
  `${value || ""}`.trim().toLowerCase();

export const normalizeVisitorId = (value) => `${value || ""}`.trim();

export const serializeArticleComments = (comments = []) =>
  [...comments]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((comment) => ({
      id: `${comment._id}`,
      name: comment.name,
      message: comment.message,
      createdAt: comment.createdAt,
    }));

export const buildArticleEngagementResponse = (
  engagement,
  visitorId = ""
) => {
  const comments = serializeArticleComments(engagement?.comments || []);
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  const likedBy = engagement?.likedBy || [];

  return {
    slug: engagement?.slug || "",
    articleTitle: engagement?.articleTitle || "",
    likes: engagement?.likes || 0,
    shares: engagement?.shares || 0,
    comments,
    commentsCount: comments.length,
    viewerHasLiked: normalizedVisitorId
      ? likedBy.includes(normalizedVisitorId)
      : false,
  };
};
