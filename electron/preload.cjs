const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('plumbago', {
  getContext: () => ipcRenderer.invoke('plumbago:get-context'),
  chooseBlog: () => ipcRenderer.invoke('plumbago:choose-blog'),
  createBlog: (input) => ipcRenderer.invoke('plumbago:create-blog', input),
  listThemes: () => ipcRenderer.invoke('plumbago:list-themes'),
  installTheme: (slug) => ipcRenderer.invoke('plumbago:install-theme', slug),
  openTheme: (slug) => ipcRenderer.invoke('plumbago:open-theme', slug),
  listPosts: () => ipcRenderer.invoke('plumbago:list-posts'),
  readPost: (id) => ipcRenderer.invoke('plumbago:read-post', id),
  savePost: (post) => ipcRenderer.invoke('plumbago:save-post', post),
  createPost: (input) => ipcRenderer.invoke('plumbago:create-post', input),
  importImages: (postId) => ipcRenderer.invoke('plumbago:import-images', postId),
  importDroppedImages: (postId, files) => {
    const sourcePaths = files.map((file) => webUtils.getPathForFile(file)).filter(Boolean)
    return ipcRenderer.invoke('plumbago:import-image-paths', postId, sourcePaths)
  },
  readAsset: (postId, name) => ipcRenderer.invoke('plumbago:read-asset', postId, name),
  gitStatus: () => ipcRenderer.invoke('plumbago:git-status'),
  gitConfig: () => ipcRenderer.invoke('plumbago:git-config'),
  saveGitConfig: (config) => ipcRenderer.invoke('plumbago:save-git-config', config),
  syncGit: (message) => ipcRenderer.invoke('plumbago:sync-git', message),
  openPreview: () => ipcRenderer.invoke('plumbago:open-preview'),
})
