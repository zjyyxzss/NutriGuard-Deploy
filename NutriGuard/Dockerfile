# 基础镜像
FROM openjdk:17-jdk-slim
# 作者
MAINTAINER user
# 挂载目录
VOLUME /tmp
# 复制打包后的 jar 文件
COPY target/nutri-guard-0.0.1-SNAPSHOT.jar app.jar
# 暴露端口
EXPOSE 8080
# 启动命令
ENTRYPOINT ["java","-jar","/app.jar"]