// Native
import path from "path";
import { writeFile, existsSync, readFile, unlinkSync } from "fs";
import os from "os";

// Packages
import inquirer, { QuestionCollection } from "inquirer";
import color from "chalk";

// Local
import jira from "./jira";
import { JiraApiOptions } from "jira-client";

// Local
export default class Config {
  filePath: string = "";
  defaults!: JiraApiOptions & { defaultBoard?: string; proxy?: string };

  private constructor() {}
  /**
   * Init config file
   */
  static async init(fileName: string): Promise<Config> {
    const config = new Config();
    config.filePath = path.join(os.homedir(), fileName);
    const filePath = config.filePath;

    // If file doesn't exist then create it
    if (!existsSync(filePath)) {
      config.defaults = await Config.createConfigFile(filePath);

      // Exit when the file is created
      process.exit();
    } else {
      config.defaults = await Config.loadConfigFile(filePath);
    }

    return config;
  }

  /**
   * Load config file
   */

  static loadConfigFile(filePath: string): Promise<JiraApiOptions> {
    return new Promise((res, rej) =>
      readFile(filePath, { encoding: "utf8" }, (err, config) => {
        if (err !== null) {
          rej(err);
        }
        res(JSON.parse(config) as unknown as JiraApiOptions);
      })
    );
  }

  /**
   * Create config file
   */
  static async createConfigFile(filePath: string): Promise<JiraApiOptions> {
    var questions = [
      {
        type: " input",
        name: "host",
        message: "Provide your jira host: ",
        default: "example.atlassian.net",
      },
      {
        type: "input",
        name: "username",
        message: "Please provide your jira username:",
        default: "example@domain.com",
      },
      {
        type: "password",
        name: "password",
        message: "Enter your jira API token:",
      },
      {
        type: "confirm",
        name: "protocol",
        message: "Enable HTTPS Protocol?",
      },
    ];

    return inquirer.prompt(questions).then(function (answers) {
      const protocol = answers.protocol ? "https" : "http";

      const config: JiraApiOptions = {
        protocol: protocol.trim(),
        host: answers.host.trim(),
        username: answers.username.trim(),
        password: answers.password.trim(),
        apiVersion: "2",
        strictSSL: true,
      };

      return new Promise((res, rej) =>
        writeFile(filePath, JSON.stringify(config), "utf8", (err) => {
          if (err !== null) {
            rej(err);
          }

          console.log("");
          console.log(
            "Config file succesfully created in: " + color.green(filePath)
          );
          console.log("");
          res(config);
        })
      );
    });
  }

  /**
   * Remove config file
   */
  removeConfigFile() {
    unlinkSync(this.filePath);
    console.log("");
    console.log(color.red("Config file succesfully deleted!"));
    console.log("");
    process.exit();
  }

  /**
   * Update config file
   */
  updateConfigFile() {
    const filePath = this.filePath;

    writeFile(filePath, JSON.stringify(this.defaults), "utf8", (err) => {
      if (err) {
        jira.showError("Error updating config file.");
        return;
      }
      console.log("");
      console.log(color.green("  Config file succesfully updated."));
      console.log("");
    });
  }

  /**
   * Update config record
   */
  async updateConfigRecord(
    cmd: string,
    val: string,
    options: { set?: boolean; remove?: boolean }
  ) {
    const _this = this;
    const boards = await jira.boards.getBoards();

    if (cmd === "username") {
      if (typeof val === "undefined") {
        console.log("");
        console.log(
          "  Current username: " + color.blue.bold(this.defaults.username)
        );
        console.log("");
      } else {
        this.defaults.username = val;

        this.updateConfigFile();
      }
    } else if (cmd == "host") {
      if (typeof val === "undefined") {
        console.log("");
        console.log("  Current host: " + color.blue.bold(this.defaults.host));
        console.log("");
      } else {
        this.defaults.host = val;

        this.updateConfigFile();
      }
    } else if (cmd == "password") {
      var questions = [
        {
          type: "password",
          name: "password",
          message: "Type your jira password:",
        },
      ];

      inquirer.prompt(questions).then(function (passwd) {
        _this.defaults.password = passwd.password;
        _this.updateConfigFile();
      });
    } else if (cmd == "board") {
      if (options.set) {
        var question: QuestionCollection = [
          {
            type: "list",
            name: "board",
            message: "Board: ",
            choices: boards,
            filter: function (val) {
              return boards.find(function (obj) {
                return obj.name == val;
              });
            },
          },
        ];

        inquirer.prompt(question).then(function (res) {
          _this.defaults.defaultBoard = res.board.id;
          _this.updateConfigFile();
        });
      } else {
        if (typeof this.defaults.defaultBoard === "undefined") {
          console.log("");
          console.log(color.red("  There is no default board set."));
        } else {
          if (options.remove) {
            delete this.defaults.defaultBoard;
            this.updateConfigFile();
          } else {
            const defaultBoard = await jira.boards.getBoard(
              this.defaults.defaultBoard
            );
            console.log("");
            console.log(
              "  Your default board is: " + color.green.bold(defaultBoard.name)
            );
          }
        }
      }
    } else if (cmd == "proxy") {
      if (typeof val === "undefined") {
        console.log("");
        console.log(
          "  Current proxy: " +
            color.blue.bold(
              this.defaults.proxy ? this.defaults.proxy : "not defined"
            )
        );
        console.log("");
      } else {
        const proxyVal = val === "remove" ? undefined : val;

        this.defaults.proxy = proxyVal;

        this.updateConfigFile();
      }
    }
  }

  /**
   * Documentation
   */
  docs() {
    console.log("");
    console.log("  Usage:  config <command>");
    console.log("");
    console.log("");
    console.log("  Commands:");
    console.log("");
    console.log("    remove   Remove the config file");
    console.log("");
  }
}
