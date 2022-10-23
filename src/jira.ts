// Native
import { URL } from "url";

// Packages
import JiraApi, { JiraApiOptions } from "jira-client";
import color from "chalk";

// Local
import Config from "./config";
import Boards from "./boards";
import Issues from "./issues";
import Projects from "./projects";
import Users from "./users";
import Versions from "./versions";
import pkg from "../package.json";

// Singleton instance
let instance: JiraCLI | null = null;

class JiraCLI {
  configFileName: string;
  config: Config;
  boards: Boards;
  issues: Issues;
  projects: Projects;
  users: Users;
  versions: Versions;
  tableChars: {
    top: string;
    "top-mid": string;
    "top-left": string;
    "top-right": string;
    bottom: string;
    "bottom-mid": string;
    "bottom-left": string;
    "bottom-right": string;
    left: string;
    "left-mid": string;
    mid: string;
    "mid-mid": string;
    right: string;
    "right-mid": string;
    middle: string;
  };
  _api?: JiraApi;

  constructor() {
    if (instance) {
      return instance;
    }
    // Set the config file name
    this.configFileName = ".jira-cli.json";

    // Create instance of each module
    this.config = new Config();
    this.boards = new Boards();
    this.issues = new Issues();
    this.projects = new Projects();
    this.users = new Users();
    this.versions = new Versions();

    // This is for cli-table defaults
    this.tableChars = {
      top: " ",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: " ",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: " ",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " ",
    };

    instance = this;
    return instance;
  }

  /**
   * Initialize the config file
   */
  async init() {
    const _self = this;

    // Get the config file
    const r = await this.config.init(this.configFileName);
    let options: JiraApiOptions = r;
    if (r.proxy) {
      const proxiedRequest = request.defaults({ proxy: r.proxy });
      options = Object.assign({}, r, { request: proxiedRequest });
    }
    // Connect  to Jira
    _self._api = new JiraApi(options);
  }

  get api() {
    return this._api!;
  }

  /**
   * Create agile URI
   */
  makeAgileUri({ pathname, query }: { pathname: string; query: string }) {
    const uri = new URL(`${this.api.base}/rest/agile/1.0${pathname}`);
    uri.protocol = this.api.protocol ?? "";
    uri.hostname = this.api.host ?? "";
    uri.port = this.api.port ?? "";
    uri.query = query ?? "";

    return decodeURIComponent(uri);
  }

  /**
   * Make an agile request
   */
  agileRequest(path: string, options = {}) {
    return this.api.doRequest(
      this.api.makeRequestHeader(
        this.makeAgileUri({
          pathname: path,
        }),
        options
      )
    );
  }

  /**
   * Make a jira API request
   */
  apiRequest(path, options = {}) {
    return this.api.doRequest(
      this.api.makeRequestHeader(
        this.api.makeUri({
          pathname: path,
        }),
        options
      )
    );
  }

  /**
   * Show errors from api response
   */
  showErrors(response: JiraApi.JsonResponse) {
    console.log("");

    if (response.statusCode == "401") {
      console.log(color.red("  Error trying to authenticate"));
    } else {
      if (typeof response.error !== "undefined") {
        let errors = response.error.errors;
        let messages = response.error.errorMessages;

        if (messages && messages.length) {
          for (var key in messages) {
            console.log(color.red("  Error: " + messages[key]));
          }
        } else {
          for (var key in errors) {
            console.log(color.red("  Error: " + errors[key]));
          }
        }
      } else if (typeof response.warningMessages !== "undefined") {
        let warnings = response.warningMessages;

        warnings.forEach((warning) => {
          console.log(color.yellow(" Warning: " + warning));
        });
      } else {
        console.log("  " + color.red(response));
      }
    }

    console.log("");
  }

  /**
   * Show error in pretty format
   */
  showError(msg: string) {
    console.log("");
    console.log(color.red("  " + msg));
    console.log("");
  }

  /**
   * Config command handler
   */
  cmdConfig(cmd: string, options) {
    // If no command is provided show help
    if (typeof cmd === "undefined") {
      this.config.docs();
    } else {
      // Remove config file
      if (cmd == "remove") {
        this.config.removeConfigFile();
      } else if (
        cmd == "host" ||
        cmd == "username" ||
        cmd == "password" ||
        cmd == "board" ||
        cmd == "proxy"
      ) {
        const val = process.argv.slice(4)[0];

        this.config.updateConfigRecord(cmd, val, options);
      }
    }
  }

  /**
   * Default command handler
   */
  cmdDefault(cli) {
    //cli.outputHelp();
  }

  /**
   * Create
   */
  cmdCreate(cmd: string, options) {
    this.issues.createIssueObj(options);
  }

  /**
   * Search
   */
  cmdSearch(args) {
    this.issues.search(args);
  }

  /**
   * Open
   */
  cmdOpen(args, options) {
    if (process.argv.slice(3).length) {
      this.issues.openIssue(args);
    }
  }

  /**
   * Projects
   */
  cmdProject(cmd, options) {
    if (typeof cmd === "undefined") {
      this.projects.list();
    } else {
      // Commands go here
    }
  }

  /**
   * Users
   */
  cmdUser(cmd, options) {
    if (typeof cmd === "undefined") {
      this.users.listUsers();
    } else {
      // Commands go here
    }
  }

  /**
   * Versions
   */
  cmdVersion(args, options) {
    if (process.argv.slice(3).length) {
      // If number option is passed create a new version
      if (options.number) {
        this.versions.createVersion(args, options);
      } else {
        this.versions.listVersions(args);
      }
    } else {
      console.log(pkg.version);
    }
  }

  /**
   * Issues
   */
  cmdIssue(args, options) {
    // If no arguments(issues) are passed
    if (!process.argv.slice(3).length || typeof args === "undefined") {
      // Get the release issues if --release option is passed
      if (options.release) {
        if (options.project) {
          this.issues.getReleaseIssues(options);
        } else {
          this.showError(
            "You must specify a project (Use project option: -p <Project Key>)"
          );
        }
      } else if (options.user) {
        // Show user summary if user option is passed
        this.issues.summary(options.user);
      } else if (options.project) {
        // Show project issues
        this.issues.getProjectIssues(options.project);
      } else {
        // Show user open issues if no arguments/options are passed
        this.issues.summary(false);
      }
    } else {
      if (options.assign) {
        // Assign issue to a user
        this.issues.assignIssue(args, options.assign);
      } else if (options.transition) {
        //Make issue transition
        this.issues.makeTransition(args, options.transition);
      } else if (options.comment) {
        // Add comment to issue
        this.issues.addComment(args, options.comment);
      } else {
        // If none of the above options is passed then search for specific issue
        this.issues.findIssue(args);
      }
    }
  }
}

export default new JiraCLI();
