const { request } = require("../../utils/api");
const app = getApp();

Page({
  data: {
    baseUrl: app.globalData.baseUrl,
    tasks: []
  },
  onShow() {
    this.load();
  },
  resolveUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//.test(url)) return url;
    return `${this.data.baseUrl}${url}`;
  },
  async load() {
    try {
      const res = await request("/api/me/history");
      const tasks = (res.items || []).map((item) => ({
        ...item,
        displayUrl: this.resolveUrl(item.resultUrl || item.personUrl)
      }));
      this.setData({ tasks });
    } catch (err) {
      wx.showToast({ title: err.message || "历史加载失败", icon: "none" });
      this.setData({ tasks: [] });
    }
  },
  openTask(e) {
    const task = this.data.tasks.find((item) => item.id === e.currentTarget.dataset.id);
    if (!task) return;
    if (task && task.status !== "success") {
      wx.navigateTo({ url: `/pages/task/index?id=${task.id}` });
      return;
    }
    wx.navigateTo({ url: `/pages/result/index?id=${e.currentTarget.dataset.id}` });
  }
});
