import "./App.css";
import {
  faPlus,
  faFileImport,
  faSave,
} from "@fortawesome/free-solid-svg-icons";
import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import FileSearch from "./components/FileSearch";
import FileList from "./components/FileList";
import BottomBtn from "./components/BottomBtn";
import TabList from "./components/TabList";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import uuidv4 from "uuid";
import { flattenArr, objToArr } from "./utils/helper";
import fileHelper from "./utils/fileHelper";
const { join, basename, extname, dirname } = window.require("path");
const { remote } = window.require("electron");
const Store = window.require("electron-store");
const fileStore = new Store({ name: "AppData" });
const saveFilesToStore = (files) => {
  const filesStoreObj = objToArr(files).reduce((result, file) => {
    const { id, path, title, createdAt } = file;
    result[id] = {
      id,
      path,
      title,
      createdAt,
    };
    return result;
  }, {});
  fileStore.set("files", filesStoreObj);
};
function App() {
  const savedLocation = remote.app.getPath("documents");
  const [files, setFiles] = useState(fileStore.get("files") || {});
  const [activeFileID, setActiveFileID] = useState("");
  const [openedFileIDs, setOpenedFiledIDs] = useState([]);
  const [unsavedFileIDs, setUnsavedFileIDs] = useState([]);
  const [searchedFiles, setSearchedFiles] = useState([]);
  const filesArr = objToArr(files);
  const openedFiles = openedFileIDs.map((openID) => {
    return files[openID];
  });
  const activeFile = files[activeFileID];
  const fileListArr = searchedFiles.length > 0 ? searchedFiles : filesArr;
  const fileClick = (fileID) => {
    setActiveFileID(fileID);
    const currentFile = files[fileID];
    if (!currentFile.isLoaded) {
      fileHelper.readFile(currentFile.path).then((value) => {
        const newFile = { ...files[fileID], body: value, isLoaded: true };
        setFiles({ ...files, [fileID]: newFile });
      });
    }
    if (!openedFileIDs.includes(fileID)) {
      setOpenedFiledIDs([...openedFileIDs, fileID]);
    }
  };
  const tabClick = (fileID) => {
    setActiveFileID(fileID);
  };
  const tabClose = (id) => {
    const tabsWithout = openedFileIDs.filter((fileID) => fileID !== id);
    setOpenedFiledIDs(tabsWithout);
    if (tabsWithout.length > 0) {
      setActiveFileID(tabsWithout[0]);
    } else {
      setActiveFileID("");
    }
  };
  const fileChange = (id, value) => {
    const newFile = { ...files[id], body: value };
    setFiles({ ...files, [id]: newFile });
    if (!unsavedFileIDs.includes(id)) {
      setUnsavedFileIDs([...unsavedFileIDs, id]);
    }
  };
  const deleteFile = (id) => {
    console.log(...files);
    if (files[id].isNew) {
      const { [id]: value, ...afterDelete } = files;
      setFiles({ afterDelete });
    } else {
      fileHelper.deleteFile(files[id].path).then(() => {
        const { [id]: value, ...afterDelete } = files;
        setFiles({ afterDelete });
        saveFilesToStore(afterDelete);
        //close the tab if open
        tabClose(id);
      });
    }
  };
  const updateFileName = (id, title, isNew) => {
    const newPath = isNew ? join(savedLocation, `${title}.md`) : join(dirname(files[id].path), `${title}.md`)
    const modifiedFile = { ...files[id], title, isNew: false, path: newPath };
    const newFiles = { ...files, [id]: modifiedFile };
    if (isNew) {
      fileHelper.writeFile(newPath, files[id].body).then(() => {
        setFiles(newFiles);
        saveFilesToStore(newFiles);
      });
    } else {
      const oldPath = files[id].path;
      fileHelper.renameFile(oldPath, newPath).then(() => {
        setFiles(newFiles);
        saveFilesToStore(newFiles);
      });
    }
  };
  const fileSearch = (keyword) => {
    const newFiles = filesArr.filter((file) => file.title.includes(keyword));
    setSearchedFiles(newFiles);
  };
  const createNewFile = () => {
    const newID = uuidv4();
    const newFile = {
      id: newID,
      title: "",
      body: "## 请输入MarkDown",
      createdAt: new Date().getTime(),
      isNew: true,
    };
    setFiles({ ...files, [newID]: newFile });
  };

  const saveCurrentFile = () => {
    const fs = window.require("fs").promises;
    const { path, body } = activeFile;
    fs.writeFile(path, body, { encoding: "utf8" }).then(() => {
      setUnsavedFileIDs(unsavedFileIDs.filter((id) => id !== activeFile.id));
    });
  };
  const importFiles = () => {
    remote.dialog
      .showOpenDialog({
        title: "Choose the MarkDown",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "MarkDown files", extensions: ["md"] }],
      })
      .then(
        (resolve) => {
          if (Array.isArray(resolve.filePaths)) {
            //filter out the path already
            const filteredPaths = resolve.filePaths.filter((path) => {
              const alreadyAdded = Object.values(files).find((file) => {
                return file.path === path;
              });
              return !alreadyAdded;
            });
            const importFilesArr = filteredPaths.map((path) => {
              return {
                id: uuidv4(),
                title: basename(path, extname(path)),
                path,
              };
            });

            const newFiles = { ...files, ...flattenArr(importFilesArr) };
            setFiles(newFiles);
            saveFilesToStore(newFiles);
            if (importFilesArr.length > 0) {
              remote.dialog.showMessageBox({
                type: "info",
                title: `Import ${importFilesArr.length}Success`,
                message: `Import ${importFilesArr.length} MarkDown Success`,
              });
            }
          }
        },
        (reason) => {
          console.log(reason);
        }
      );
  };
  return (
    <div className="App" container-fluid px-0>
      <div className="row no-gutters">
        <div className="col-3 bg-light left-panel">
          <FileSearch title="云文档" onFileSearch={fileSearch} />
          <FileList
            files={fileListArr}
            onFileClick={fileClick}
            onFileDelete={deleteFile}
            onSaveEdit={updateFileName}
          />
          <div className="row no-gutters button-group">
            <div className="col">
              <BottomBtn
                text="新建"
                colorClass="btn-primary"
                icon={faPlus}
                onBtnClick={createNewFile}
              />
            </div>
            <div className="col">
              <BottomBtn
                text="导入"
                colorClass="btn-success"
                icon={faFileImport}
                onBtnClick={importFiles}
              />
            </div>
          </div>
        </div>
        <div className="col-9  right-panel">
          {!activeFile && (
            <div className="start-page">选择或者创建新的MarkDown</div>
          )}
          {activeFile && (
            <>
              <TabList
                files={openedFiles}
                activeId={activeFileID}
                unsaveIds={unsavedFileIDs}
                onTabClick={tabClick}
                onCloseTab={tabClose}
              />
              <SimpleMDE
                key={activeFile && activeFile.id}
                value={activeFile && activeFile.body}
                onChange={(value) => {
                  fileChange(activeFile.id, value);
                }}
                options={{
                  minHeight: "515px",
                }}
              />
              <BottomBtn
                text="保存"
                colorClass="btn-success"
                icon={faSave}
                onBtnClick={saveCurrentFile}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
