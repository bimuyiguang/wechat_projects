const { request } = require("../../utils/api");
const app = getApp();

Page({
  data: {
    baseUrl: app.globalData.baseUrl,
    task: {},
    videoTask: {},
    resultImageUrl: "",
    videoUrl: "",
    posterUrl: "",
    videoHint: "可选"
  },
  async onLoad(query) {
    const task = await request(`/api/tasks/${query.id}`);
    this.taskId = query.id;
    this.updateViewState(task, {});
    if (query.videoId) {
      const videoTask = await request(`/api/videos/${query.videoId}`);
      this.updateViewState(task, videoTask);
    }
  },
  resolveUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//.test(url)) return url;
    return `${this.data.baseUrl}${url}`;
  },
  updateViewState(task = {}, videoTask = {}) {
    this.setData({
      task,
      videoTask,
      resultImageUrl: this.resolveUrl(task.resultUrl),
      videoUrl: this.resolveUrl(videoTask.videoUrl),
      posterUrl: this.resolveUrl(videoTask.posterUrl || task.resultUrl),
      videoHint: videoTask.status || "可选"
    });
  },
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: "/pages/history/index" });
  },
  previewResult() {
    if (!this.data.resultImageUrl) return;
    wx.previewImage({
      current: this.data.resultImageUrl,
      urls: [this.data.resultImageUrl]
    });
  },
  previewVideoPoster() {
    if (!this.data.posterUrl) return;
    wx.previewImage({
      current: this.data.posterUrl,
      urls: [this.data.posterUrl]
    });
  },
  async startVideo() {
    wx.showLoading({ title: "提交视频任务" });
    try {
      const resp = await request("/api/videos", "POST", {
        sourceTaskId: this.taskId,
        imageUrl: this.data.task.resultUrl,
        publicImageUrl: this.data.task.providerResultUrl || "",
        fallbackToMock: false,
        title: "结果图展示视频",
        prompt: "Generate a five-second 720p fashion showcase video from the result image. Use a subtle runway camera push-in, keep the outfit, face, body pose and background consistent, emphasize garment texture and premium fashion presentation."
      });
      wx.hideLoading();
      this.updateViewState(this.data.task, resp.videoTask);
      wx.redirectTo({ url: `/pages/task/index?id=${this.taskId}&videoId=${resp.videoTaskId}` });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || "视频任务创建失败", icon: "none" });
    }
  },
  saveImage() {
    this.saveFileToAlbum(this.data.resultImageUrl, "image");
  },
  saveVideo() {
    if (!this.data.videoUrl) {
      wx.showToast({ title: "视频还没有生成", icon: "none" });
      return;
    }
    this.saveFileToAlbum(this.data.videoUrl, "video");
  },
  saveFileToAlbum(url, type) {
    if (!url) {
      wx.showToast({ title: "暂无文件", icon: "none" });
      return;
    }
    wx.showLoading({ title: "保存中" });
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({ title: "下载失败", icon: "none" });
          return;
        }
        const apiName = type === "video" ? "saveVideoToPhotosAlbum" : "saveImageToPhotosAlbum";
        wx[apiName]({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: "已保存到相册", icon: "success" });
          },
          fail: (err) => {
            wx.hideLoading();
            if (err.errMsg && err.errMsg.includes("auth")) {
              wx.showModal({
                title: "需要授权",
                content: "请在设置中允许保存到相册",
                confirmText: "去设置",
                success: (modalRes) => {
                  if (modalRes.confirm) wx.openSetting();
                }
              });
            } else {
              wx.showToast({ title: "保存失败", icon: "none" });
            }
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "下载失败", icon: "none" });
      }
    });
  },
  again() {
    wx.switchTab({ url: "/pages/generate/index" });
  }
});
