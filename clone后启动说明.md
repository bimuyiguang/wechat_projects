首先将.env配置文件复制到fabric-mind目录下。.env里面写了数据库的配置文件。以后如果有其它的配置信息，尽量写在一个.env配置文件内。方便使用。

因为git提交的时候把.env给忽略掉了，所以每次clone下来后都必须要将.env配置文件粘贴一份在fabric-mind目录下。



在npm run dev之前最好进行npm install.每次都这样



总结：

1    fabric-mind目录下面粘贴.env配置文件

2    npm install（两个npm run dev启动前都需要）

3    npm run dev

