const { request } = require("../../utils/api");
const app = getApp();

Page({
  data: {
    baseUrl: app.globalData.baseUrl,
    task: {},
    videoTask: {},
    titleText: "正在生成",
    subtitleText: "",
    personImageUrl: "",
    secondImageUrl: "",
    secondImageMode: "aspectFit",
    imageStatusText: "图片生成中 0%",
    videoStatusText: "等待视频生成"
  },
  onLoad(query) {
    this.taskId = query.id;
    this.videoId = query.videoId || "";
    this.poll();
    if (this.videoId) this.pollVideo();
  },
  async poll() {
    const task = await request(`/api/tasks/${this.taskId}`);
    this.updateViewState(task, this.data.videoTask);
    if (this.videoId) return;
    if (task.status === "success") {
      wx.redirectTo({ url: `/pages/result/index?id=${task.id}` });
      return;
    }
    setTimeout(() => this.poll(), 900);
  },
  async pollVideo() {
    const videoTask = await request(`/api/videos/${this.videoId}`);
    this.updateViewState(this.data.task, videoTask);
    if (videoTask.status === "success" || videoTask.status === "failed") {
      wx.redirectTo({ url: `/pages/result/index?id=${this.taskId}&videoId=${videoTask.id}` });
      return;
    }
    setTimeout(() => this.pollVideo(), 2000);
  },
  resolveUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//.test(url)) return url;
    return `${this.data.baseUrl}${url}`;
  },
  updateViewState(task = {}, videoTask = {}) {
    const isVideoFlow = Boolean(videoTask.id);
    const taskProgress = Number(task.progress || 0);
    const videoProgress = Number(videoTask.progress || 0);
    const imageStatusText = task.status === "success" ? "图片已完成" : `图片生成中 ${taskProgress}%`;
    let videoStatusText = "等待图片完成后生成视频";

    if (isVideoFlow) {
      if (videoTask.status === "success") videoStatusText = "视频已完成";
      else if (videoTask.status === "failed") videoStatusText = "视频生成失败";
      else videoStatusText = `视频生成中 ${videoProgress}%`;
    }

    this.setData({
      task,
      videoTask,
      titleText: isVideoFlow ? "正在生成展示视频" : "正在生成",
      subtitleText: isVideoFlow ? `图片任务 ${task.id || this.taskId} · 视频任务 ${videoTask.id}` : `图片任务 ${task.id || this.taskId}`,
      personImageUrl: this.resolveUrl(task.personUrl),
      secondImageUrl: this.resolveUrl(isVideoFlow ? task.resultUrl : task.garmentUrl),
      secondImageMode: isVideoFlow ? "aspectFill" : "aspectFit",
      imageStatusText,
      videoStatusText
    });
  },
  goHistory() {
    wx.switchTab({ url: "/pages/history/index" });
  }
});
