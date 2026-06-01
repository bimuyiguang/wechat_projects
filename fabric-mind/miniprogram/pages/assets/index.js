const { request } = require("../../utils/api");
const app = getApp();

const tabs = [
  { key: "all", label: "全部" },
  { key: "person", label: "人物" },
  { key: "top", label: "上衣" },
  { key: "bottom", label: "下装" },
  { key: "outfit", label: "整套" }
];

Page({
  data: {
    tabs,
    assets: [],
    filteredAssets: [],
    activeTab: "all"
  },
  onShow() {
    this.loadAssets();
  },
  async loadAssets() {
    const res = await request("/api/assets");
    const assets = (res.items || []).map((item) => ({
      ...item,
      displayUrl: this.resolveUrl(item.displayUrl || item.ossUrl || item.url),
      apiUrl: item.apiUrl || item.ossUrl || item.url
    }));
    this.setData({ assets }, this.filterAssets);
  },
  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab }, this.filterAssets);
  },
  filterAssets() {
    const { assets, activeTab } = this.data;
    const map = {
      person: ["人物", "模特"],
      top: ["上衣"],
      bottom: ["下装", "裤子", "裙子"],
      outfit: ["整套", "套装", "服装"]
    };
    const types = map[activeTab];
    const filteredAssets = !types ? assets : assets.filter((item) => types.includes(item.type));
    this.setData({ filteredAssets });
  },
  selectAsset(e) {
    const id = e.currentTarget.dataset.id;
    const asset = this.data.assets.find((item) => item.id === id);
    if (!asset) return;

    const apiUrl = asset.apiUrl || asset.ossUrl || asset.url;
    const selected = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      apiUrl,
      displayUrl: this.resolveUrl(asset.displayUrl || apiUrl)
    };

    if (["人物", "模特"].includes(asset.type)) {
      app.globalData.selectedPerson = selected;
      wx.switchTab({ url: "/pages/generate/index" });
      return;
    }

    app.globalData.selectedGarment = selected;
    wx.switchTab({ url: "/pages/generate/index" });
  },
  previewAsset(e) {
    const id = e.currentTarget.dataset.id;
    const asset = this.data.assets.find((item) => item.id === id);
    if (!asset) return;
    wx.previewImage({
      current: asset.displayUrl,
      urls: this.data.filteredAssets.map((item) => item.displayUrl)
    });
  },
  resolveUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//.test(url) || url.startsWith("wxfile://") || url.startsWith("http://tmp/")) return url;
    return `${app.globalData.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }
});
